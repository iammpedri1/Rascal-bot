import { defineCommand } from "../types/command";
import type { GuildMember, Role } from "discord.js";
import type { ShopRoleOffer, ShopRoleKind } from "../utils/shopRolePurchases";
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");

const emoji = require("../utils/emojis") as typeof import("../utils/emojis") & Record<string, any>;
const cooldowns = require("../utils/cooldowns");
const { SHOP_SECTIONS, guildRoleOffers, vipBenefitsFor } = require("../utils/cookieShop");
const { randomColor } = require("../utils/embedStyle");
const logger = require("../utils/logger");
const {
  getProfile,
  getGuildShopRolePurchase,
  purchaseCooldownUnlock,
} = require("../utils/cookieEconomy");
const rolePurchases = require("../utils/shopRolePurchases") as typeof import("../utils/shopRolePurchases");
const blackMarket = require("../utils/blackMarket") as typeof import("../utils/blackMarket");
const { PRIMARY_GUILD_ID } = require("../utils/primaryGuild") as typeof import("../utils/primaryGuild");

const COLOR_PAGE_SIZE = 10;
const VIP_PAGE_SIZE = 5;
const activePurchaseUsers = new Set<string>();
const ACCELERATORS = [
  { id: "daily", label: "Daily", targets: ["daily"], price: 10000, emoji: "cookie", fallback: "🍪" },
  { id: "roubar", label: "Roubar", targets: ["roubar"], price: 3500, emoji: "pand_police", fallback: "🚨" },
  { id: "trabalhar", label: "Trabalhar", targets: ["trabalhar"], price: 4600, emoji: "work", fallback: "💼" },
  { id: "todos", label: "Todos", targets: ["daily", "roubar", "trabalhar"], price: 18000, emoji: "clock", fallback: "⏳" },
];

function amount(value: number): string {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("pt-BR");
}

function timestamp(value: number): string {
  return `<t:${Math.floor(value / 1000)}:R>`;
}

function pageCountFor(kind: ShopRoleKind, count: number): number {
  const size = kind === "color" ? COLOR_PAGE_SIZE : VIP_PAGE_SIZE;
  return Math.max(1, Math.ceil(count / size));
}

function displayColorNumber(offer: ShopRoleOffer, absoluteIndex: number): string {
  const match = offer.name.match(/(?:^|\D)(\d{1,2})(?:\D|$)/);
  return match?.[1] || String(absoluteIndex + 1);
}

function buttonEmoji(button: InstanceType<typeof ButtonBuilder>, name: string, fallback: string) {
  return emoji.setApplicationButtonEmoji(button, name, fallback);
}

function storeMember(interaction): GuildMember | undefined {
  const cached = interaction.guild.members.cache.get(interaction.user.id);
  if (cached) return cached;
  const member = interaction.member as GuildMember | { roles?: unknown } | null;
  return member?.roles && !Array.isArray(member.roles) ? member as GuildMember : undefined;
}

function categoryRow(interaction, sectionId: string) {
  const sections = [...SHOP_SECTIONS];
  const member = storeMember(interaction);
  if (member && blackMarket.isVipMember(interaction.guild, member)) {
    sections.push({ id: "mercado_negro", name: "Mercado Negro" });
  }
  const buttons = sections.map((section) => {
    const config = section.id === "cores"
      ? { emoji: "palette", fallback: "🎨" }
      : section.id === "vip"
        ? { emoji: "owner", fallback: "👑" }
        : section.id === "mercado_negro"
          ? { emoji: "pand_police", fallback: "🕶️" }
          : { emoji: "clock", fallback: "⏳" };
    const button = new ButtonBuilder()
      .setCustomId(`loja|categoria|${section.id}`)
      .setLabel(section.name)
      .setStyle(sectionId === section.id ? ButtonStyle.Success : ButtonStyle.Secondary);
    return buttonEmoji(button, config.emoji, config.fallback);
  });
  return new ActionRowBuilder().addComponents(...buttons);
}

function navigationRow(sectionId: string, page: number, pages: number) {
  const buttons = [
    buttonEmoji(new ButtonBuilder()
      .setCustomId("loja|home")
      .setLabel("Voltar")
      .setStyle(ButtonStyle.Secondary), "previous", "⬅️"),
  ];

  if (pages > 1) {
    buttons.push(
      buttonEmoji(new ButtonBuilder()
        .setCustomId("loja|pagina|anterior")
        .setLabel("Anterior")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0), "previous", "◀️"),
      new ButtonBuilder()
        .setCustomId("loja|pagina|estado")
        .setLabel(`${page + 1}/${pages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      buttonEmoji(new ButtonBuilder()
        .setCustomId("loja|pagina|proxima")
        .setLabel("Próxima")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pages - 1), "next", "▶️"),
    );
  }

  buttons.push(buttonEmoji(new ButtonBuilder()
    .setCustomId("loja|fechar")
    .setLabel("Fechar")
    .setStyle(ButtonStyle.Danger), "crossed", "❌"));
  return new ActionRowBuilder().addComponents(...buttons);
}

function roleStatus(kind: ShopRoleKind, offer: ShopRoleOffer, assigned: boolean, purchase: any): string {
  if (kind === "color") {
    if (assigned) return `${emoji.application("correct", "✅")} **Equipado**`;
    if (purchase) return `${emoji.application("correct", "✅")} **Adquirido** · Toque para equipar`;
    return `${emoji.application("cookie", "🍪")} \`${amount(offer.price)}\` cookies`;
  }

  const active = Number(purchase?.expiresAt) > Date.now();
  if (active && assigned) return `${emoji.application("clock", "⏰")} **Ativo** até ${timestamp(purchase.expiresAt)}`;
  if (active) return `${emoji.application("correct", "✅")} **Ativo** · Toque para equipar`;
  if (purchase) return `${emoji.application("clock", "⏰")} **Expirado** · \`${amount(offer.price)}\` cookies / 30 dias`;
  if (assigned) return `${emoji.application("correct", "✅")} **Já possui este cargo**`;
  return `${emoji.application("cookie", "🍪")} \`${amount(offer.price)}\` cookies / 30 dias`;
}

function buildRoleEmbed(interaction, sectionId: "cores" | "vip", page: number, notice: string) {
  const kind: ShopRoleKind = sectionId === "cores" ? "color" : "vip";
  const offers: ShopRoleOffer[] = guildRoleOffers(interaction.guild, kind);
  const size = kind === "color" ? COLOR_PAGE_SIZE : VIP_PAGE_SIZE;
  const pages = pageCountFor(kind, offers.length);
  const currentPage = Math.max(0, Math.min(page, pages - 1));
  const visible = offers.slice(currentPage * size, currentPage * size + size);
  const profile = getProfile(interaction.user);
  const lines = visible.map((offer, index) => {
    const purchase = getGuildShopRolePurchase(interaction.guildId, interaction.user.id, offer.roleId, kind);
    const assigned = interaction.guild.members.cache.get(interaction.user.id)?.roles.cache.has(offer.roleId) || false;
    const label = kind === "color" ? displayColorNumber(offer, currentPage * size + index) : offer.name;
    const details = kind === "vip"
      ? `\n   ${emoji.application("sparkles", "✨")} ${vipBenefitsFor(offer)}`
      : "";
    return `${emoji.application("next", "›")} **${label}** • ${offer.mention}\n   ${roleStatus(kind, offer, assigned, purchase)}${details}`;
  });

  const title = kind === "color" ? "Cores Personalizadas" : "Assinaturas VIP";
  const sectionIcon = emoji.getEmojiDetails(kind === "color" ? "palette" : "owner")?.imageUrl || null;

  const description = offers.length
    ? [
      kind === "color"
        ? "Selecione um número abaixo para adquirir e equipar uma cor exclusiva em seu nome."
        : "Adquira cargos de prestígio com multiplicadores de cookies e acesso ao Mercado Negro.",
      "",
      ...lines,
      "",
      `${emoji.application("cookie", "🍪")} **Seu Saldo:** \`${amount(profile.balance)}\` cookies`,
      notice ? `\n${notice}` : "",
    ].filter(Boolean).join("\n")
    : [
      kind === "color"
        ? "Nenhuma cor disponível no momento. A equipe administrativa deve configurar os cargos numerados."
        : "Nenhum plano VIP configurado. Verifique os nomes dos cargos e a hierarquia do Rascal.",
      "",
      `${emoji.application("cookie", "🍪")} **Seu Saldo:** \`${amount(profile.balance)}\` cookies`,
      notice ? `\n${notice}` : "",
    ].filter(Boolean).join("\n");

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: `Shopping Rascal • ${title}`,
      iconURL: sectionIcon || undefined
    })
    .setThumbnail(sectionIcon)
    .setDescription(description)
    .setFooter({ text: `Página ${currentPage + 1} de ${pages} • Shopping Rascal` });

  return { embed, offers, page: currentPage, pages, visible, profile };
}

function buildHomeEmbed(interaction, notice: string) {
  const profile = getProfile(interaction.user);
  const member = storeMember(interaction);
  const marketAvailable = Boolean(member && blackMarket.isVipMember(interaction.guild, member));
  const trophy = emoji.application("trophy", "🏆");

  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: `Shopping Rascal • ${interaction.guild.name}`,
      iconURL: interaction.guild.iconURL() || undefined
    })
    .setTitle(`${emoji.application("shop", "🛍️")} Loja de Itens e Vantagens`)
    .setThumbnail(emoji.getEmojiDetails("shop")?.imageUrl || null)
    .setDescription([
      "Bem-vindo à loja oficial! Aqui você pode investir seus cookies em cargos de prestígio, cores personalizadas e itens táticos.",
      "",
      `${emoji.application("palette", "🎨")} **Categorias Disponíveis:**`,
      `> • **Cores:** Personalize seu nome no chat com cores vibrantes.`,
      `> • **VIPs:** Ganhe bônus de economia e acesso a áreas restritas.`,
      `> • **Aceleradores:** Remova cooldowns de comandos instantaneamente.`,
      ...(marketAvailable ? [`> • **Mercado Negro:** Itens exclusivos para membros VIP.`] : []),
      "",
      `${emoji.application("cookie", "🍪")} **Seu Saldo:** \`${amount(profile.balance)}\` cookies`,
      notice ? `\n${notice}` : ""
    ].join("\n"))
    .setFooter({ text: "Use os botões abaixo para navegar entre as categorias." });
}

function buildBlackMarketEmbed(interaction, notice: string) {
  const profile = getProfile(interaction.user);
  const sectionIcon = emoji.getEmojiDetails("pand_police")?.imageUrl || null;
  const lines = blackMarket.BLACK_MARKET_ITEMS.map((item) => {
    const quantity = blackMarket.getInventoryCount(interaction.user.id, item.id);
    return `${emoji.application("next", "›")} **${item.name}**\n   ${emoji.application("cookie", "🍪")} \`${amount(item.price)}\` cookies\n   ${emoji.application("warning", "📦")} No inventário: **${quantity}**\n   ${emoji.application("info", "ℹ️")} ${item.description}`;
  });

  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: "Shopping Rascal • Mercado Negro",
      iconURL: sectionIcon || undefined
    })
    .setThumbnail(sectionIcon)
    .setDescription([
      "Equipamentos táticos exclusivos para membros VIP. Itens consumíveis usados automaticamente no próximo roubo.",
      "",
      ...lines,
      "",
      `${emoji.application("cookie", "🍪")} **Seu Saldo:** \`${amount(profile.balance)}\` cookies`,
      notice ? `\n${notice}` : "",
    ].filter(Boolean).join("\n"))
    .setFooter({ text: "Acesso restrito a membros Star VIP ou superior. • Shopping Rascal" });
}

function buildAcceleratorEmbed(interaction, notice: string) {
  const profile = getProfile(interaction.user);
  const cooldownsForUser = cooldowns.allForUser(interaction.user.id);
  const targets = { daily: "daily", roubar: "rob", trabalhar: "work" };
  const lines = ACCELERATORS.map((offer) => {
    const ready = offer.targets.some((target) => !cooldowns.check(interaction.user.id, target).ready);
    const state = offer.targets.map((target) => {
      const key = targets[target];
      const cooldown = cooldownsForUser[key];
      return cooldown?.ready ? null : `/${target} pronto ${timestamp(cooldown.expiresAt)}`;
    }).filter(Boolean).join(" · ");
    return `${emoji.application("next", "›")} **${offer.label}**\n   ${emoji.application("cookie", "🍪")} \`${amount(offer.price)}\` cookies\n   ${ready ? `${emoji.application("clock", "⏰")} ${state}` : `${emoji.application("correct", "✅")} Sem cooldown ativo`}`;
  });

  const sectionIcon = emoji.getEmojiDetails("clock")?.imageUrl || null;

  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: "Shopping Rascal • Aceleradores",
      iconURL: sectionIcon || undefined
    })
    .setThumbnail(sectionIcon)
    .setDescription([
      "Remova restrições de tempo instantaneamente para voltar à ação.",
      "",
      ...lines,
      "",
      `${emoji.application("cookie", "🍪")} **Seu Saldo:** \`${amount(profile.balance)}\` cookies`,
      notice ? `\n${notice}` : "",
    ].filter(Boolean).join("\n"))
    .setFooter({ text: "Aceleradores são de uso imediato após a compra. • Shopping Rascal" });
}

function buildRoleButtons(interaction, kind: ShopRoleKind, offers: ShopRoleOffer[], page: number) {
  const size = kind === "color" ? COLOR_PAGE_SIZE : VIP_PAGE_SIZE;
  const visible = offers.slice(page * size, page * size + size);
  return visible.map((offer, index) => {
    const member = interaction.guild.members.cache.get(interaction.user.id);
    const assigned = member?.roles.cache.has(offer.roleId) || false;
    const purchase = getGuildShopRolePurchase(interaction.guildId, interaction.user.id, offer.roleId, kind);
    const activeVip = kind === "vip" && Number(purchase?.expiresAt) > Date.now();
    const canReapply = kind === "color" ? Boolean(purchase) : Boolean(activeVip);
    const cannotBuyBecauseAlreadyAssigned = assigned && !canReapply;
    const cannotAfford = !canReapply && getProfile(interaction.user).balance < offer.price;
    const label = kind === "color"
      ? displayColorNumber(offer, page * size + index)
      : offer.name.slice(0, 80);
    const button = new ButtonBuilder()
      .setCustomId(`loja|cargo|${kind}|${offer.roleId}`)
      .setLabel(label)
      .setStyle(kind === "color" ? ButtonStyle.Primary : ButtonStyle.Success)
      .setDisabled(cannotBuyBecauseAlreadyAssigned || cannotAfford);
    if (kind === "vip") buttonEmoji(button, "owner", "👑");
    return button;
  });
}

function buildComponents(interaction, sectionId: string, page: number, notice: string) {
  if (sectionId === "home") return [categoryRow(interaction, sectionId)];
  const rows = [];

  if (sectionId === "cores" || sectionId === "vip") {
    const kind: ShopRoleKind = sectionId === "cores" ? "color" : "vip";
    const offers = guildRoleOffers(interaction.guild, kind);
    const pages = pageCountFor(kind, offers.length);
    const currentPage = Math.max(0, Math.min(page, pages - 1));
    const buttons = buildRoleButtons(interaction, kind, offers, currentPage);
    for (let offset = 0; offset < buttons.length; offset += 5) {
      rows.push(new ActionRowBuilder().addComponents(...buttons.slice(offset, offset + 5)));
    }
    rows.push(navigationRow(sectionId, currentPage, pages));
    return rows;
  }

  if (sectionId === "aceleradores") {
    rows.push(new ActionRowBuilder<any>().addComponents(...ACCELERATORS.map((offer) => {
      const hasCooldown = offer.targets.some((target) => !cooldowns.check(interaction.user.id, target).ready);
      const canAfford = getProfile(interaction.user).balance >= offer.price;
      const button = new ButtonBuilder()
        .setCustomId(`loja|acelerador|${offer.id}`)
        .setLabel(`${offer.label} (${amount(offer.price)})`)
        .setStyle(offer.id === "todos" ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(!hasCooldown || !canAfford);
      return buttonEmoji(button, offer.emoji, offer.fallback);
    })));
    rows.push(navigationRow(sectionId, 0, 1));
    return rows;
  }

  if (sectionId === "mercado_negro") {
    const buttons = blackMarket.BLACK_MARKET_ITEMS.map((item) => {
      const button = new ButtonBuilder()
        .setCustomId(`loja|mercado|comprar|${item.id}`)
        .setLabel(`${item.name} (${amount(item.price)})`)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(getProfile(interaction.user).balance < item.price);
      return buttonEmoji(button, item.emoji, item.fallback);
    });
    rows.push(new ActionRowBuilder<any>().addComponents(...buttons));
    rows.push(navigationRow(sectionId, 0, 1));
    return rows;
  }

  return [categoryRow(interaction, sectionId)];
}

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("loja")
    .setDescription("Adquira cores personalizadas, assinaturas VIP e aceleradores exclusivos"),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Por favor, utilize o comando `/loja` dentro de um servidor.", flags: MessageFlags.Ephemeral });
    }
    if (!PRIMARY_GUILD_ID || interaction.guildId !== PRIMARY_GUILD_ID) {
      return interaction.reply({ content: "O Shopping Rascal está disponível exclusivamente no servidor oficial.", flags: MessageFlags.Ephemeral });
    }

    let sectionId = "home";
    let page = 0;
    let notice = "";
    await interaction.deferReply();
    const message = await interaction.editReply({
      embeds: [buildHomeEmbed(interaction, notice)],
      components: [categoryRow(interaction, sectionId)],
      allowedMentions: { parse: [] },
    });
    const collector = message.createMessageComponentCollector({ time: 180_000 });

    collector.on("collect", async (component) => {
      if (component.user.id !== interaction.user.id) {
        await component.reply({ content: "Esta loja foi aberta por outra pessoa.", flags: MessageFlags.Ephemeral });
        return;
      }

      const id = component.customId;
      const isPurchase = id.startsWith("loja|cargo|") || id.startsWith("loja|acelerador|") || id.startsWith("loja|mercado|comprar|");
      if (isPurchase && activePurchaseUsers.has(component.user.id)) {
        await component.reply({ content: `${emoji.clock} Sua outra compra ainda está sendo processada. Aguarde.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (isPurchase) activePurchaseUsers.add(component.user.id);

      try {
        await component.deferUpdate();
        notice = "";

        if (id.startsWith("loja|categoria|")) {
          const selected = id.split("|")[2];
          const member = storeMember(component);
          const canOpenMarket = selected === "mercado_negro" && Boolean(member && blackMarket.isVipMember(interaction.guild, member));
          if (SHOP_SECTIONS.some((entry) => entry.id === selected) || canOpenMarket) {
            sectionId = selected;
            page = 0;
          } else if (selected === "mercado_negro") {
            sectionId = "home";
            notice = `${emoji.redTick} O Mercado Negro é restrito aos VIPs deste servidor.`;
          }
        } else if (id === "loja|home") {
          sectionId = "home";
          page = 0;
        } else if (id === "loja|pagina|anterior") {
          page = Math.max(0, page - 1);
        } else if (id === "loja|pagina|proxima") {
          const kind: ShopRoleKind = sectionId === "cores" ? "color" : "vip";
          page = Math.min(pageCountFor(kind, guildRoleOffers(interaction.guild, kind).length) - 1, page + 1);
        } else if (id.startsWith("loja|cargo|")) {
          const [, , kindText, roleId] = id.split("|");
          const kind = kindText as ShopRoleKind;
          const member = component.member as GuildMember;
          const role: Role | undefined = interaction.guild.roles.cache.get(roleId);
          const offer: ShopRoleOffer | undefined = guildRoleOffers(interaction.guild, kind)
            .find((candidate) => candidate.roleId === roleId);
          if (!role || !offer) {
            notice = `${emoji.redTick} Esse cargo não está mais disponível na loja.`;
          } else {
            notice = await processGuildRolePurchase(component, member, role, offer);
          }
        } else if (id.startsWith("loja|acelerador|")) {
          const offer = ACCELERATORS.find((entry) => entry.id === id.split("|")[2]);
          if (!offer) {
            notice = `${emoji.redTick} Esse acelerador não existe.`;
          } else {
            const result = purchaseCooldownUnlock(interaction.user, offer.targets, offer.price, {
              guildId: interaction.guildId,
              guildName: interaction.guild.name,
            });
            if (result.ok) notice = `${emoji.correct} Cooldown liberado: ${result.targets.map((target) => `/${target}`).join(", ")}.`;
            else if (result.reason === "balance") notice = `${emoji.redTick} Saldo insuficiente para esse acelerador.`;
            else if (result.reason === "cooldown_ready") notice = `${emoji.thinking} Esse cooldown já está liberado.`;
            else notice = `${emoji.redTick} Não consegui aplicar esse acelerador.`;
          }
        } else if (id.startsWith("loja|mercado|comprar|")) {
          const itemId = id.split("|")[3];
          const member = storeMember(component);
          const item = blackMarket.BLACK_MARKET_ITEMS.find((entry) => entry.id === itemId);
          if (!member || !blackMarket.isVipMember(interaction.guild, member)) {
            sectionId = "home";
            notice = `${emoji.redTick} O Mercado Negro é restrito aos VIPs deste servidor.`;
          } else if (!item) {
            notice = `${emoji.redTick} Esse item não está disponível.`;
          } else {
            const purchase = blackMarket.purchaseItem(interaction.user, item.id, interaction.guildId, interaction.guild.name);
            notice = purchase.ok === true
              ? `${emoji.correct} **${item.name}** comprado. Você tem ${blackMarket.getInventoryCount(interaction.user.id, item.id)} unidade(s).`
              : `${emoji.redTick} ${purchase.reason === "balance" ? "Saldo insuficiente." : "Esse item não está disponível."}`;
          }
        } else if (id === "loja|fechar") {
          collector.stop("closed");
          await component.editReply({ components: [] });
          return;
        } else {
          await component.followUp({ content: "Ação da loja inválida. Abra /loja novamente.", flags: MessageFlags.Ephemeral });
          return;
        }

        const embeds = sectionId === "home"
          ? [buildHomeEmbed(interaction, notice)]
          : sectionId === "aceleradores"
            ? [buildAcceleratorEmbed(interaction, notice)]
            : sectionId === "mercado_negro"
              ? [buildBlackMarketEmbed(interaction, notice)]
              : [buildRoleEmbed(interaction, sectionId as "cores" | "vip", page, notice).embed];
        await component.editReply({
          embeds,
          components: buildComponents(interaction, sectionId, page, notice),
          allowedMentions: { parse: [] },
        });
      } catch (error) {
        logger.error("Falha ao processar interação da loja", error, {
          userId: component.user.id,
          customId: component.customId,
        });
        await component.followUp({
          content: `${emoji.redTick} Não consegui concluir a ação. Tente novamente.`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => undefined);
      } finally {
        if (isPurchase) activePurchaseUsers.delete(component.user.id);
      }
    });

    collector.on("end", () => {
      message.edit({ components: [] }).catch(() => undefined);
    });
  },
});

async function processGuildRolePurchase(
  interaction,
  member: GuildMember,
  role: Role,
  offer: ShopRoleOffer,
): Promise<string> {
  const alreadyAssigned = member.roles.cache.has(role.id);
  const existing = getGuildShopRolePurchase(interaction.guildId, interaction.user.id, role.id, offer.kind);

  if (alreadyAssigned && offer.kind === "color") {
    return `${emoji.thinking} Você já está usando essa cor; nenhum cookie foi cobrado.`;
  }
  if (alreadyAssigned && offer.kind === "vip" && !existing) {
    return `${emoji.thinking} Você já possui esse VIP; nenhum cookie foi cobrado.`;
  }

  const activePurchase = existing && (offer.kind === "color" || Number(existing.expiresAt) > Date.now());
  if (!alreadyAssigned && activePurchase) {
    try {
      await member.roles.add(role, "Reaplicação de um cargo comprado na loja");
      return `${emoji.correct} Cargo ${role} reaplicado sem nova cobrança.`;
    } catch (error) {
      logger.error("Falha ao reaplicar cargo comprado", error, { roleId: role.id, userId: interaction.user.id });
      return discordErrorCode(error) === 50013
        ? `${emoji.redTick} Não consigo aplicar o cargo. A equipe precisa mover o cargo do Rascal acima dele.`
        : `${emoji.redTick} Não consegui aplicar o cargo agora.`;
    }
  }

  const reservation = rolePurchases.reserveRolePurchase(
    { id: interaction.user.id, username: interaction.user.username },
    offer,
    { guildId: interaction.guildId, guildName: interaction.guild.name },
  );
  if (reservation.ok === false) {
    if (reservation.reason === "balance") return `${emoji.redTick} Você precisa de ${amount(offer.price)} cookies para comprar esse cargo.`;
    if (reservation.reason === "owned") return `${emoji.thinking} Essa cor já está registrada na sua coleção.`;
    if (reservation.reason === "busy") return `${emoji.clock} Sua outra compra ainda está sendo processada.`;
    return `${emoji.redTick} Não consegui concluir essa compra.`;
  }

  try {
    await member.roles.add(role, "Cargo comprado na loja com cookies");
  } catch (error) {
    logger.error("Falha ao aplicar cargo comprado", error, {
      roleId: role.id,
      userId: interaction.user.id,
      reservationId: reservation.reservation.id,
    });
    const code = discordErrorCode(error);
    let applied: boolean | null = code === 50013 ? false : null;
    if (applied === null) {
      try {
        const freshMember = await interaction.guild.members.fetch(interaction.user.id);
        applied = freshMember.roles.cache.has(role.id);
      } catch (verificationError) {
        logger.warn("Não foi possível confirmar a aplicação do cargo", {
          roleId: role.id,
          userId: interaction.user.id,
          code: discordErrorCode(verificationError),
        });
      }
    }
    if (applied === true) {
      rolePurchases.completeRolePurchase(reservation.reservation.id);
      return `${emoji.correct} Cargo aplicado e compra registrada.`;
    }
    if (applied === false) {
      const refunded = rolePurchases.refundRolePurchase(reservation.reservation.id, "Discord recusou a aplicação do cargo");
      return refunded
        ? `${emoji.redTick} A compra foi cancelada e os cookies devolvidos. Confira se o cargo do Rascal está acima do cargo da loja.`
        : `${emoji.redTick} O estorno está pendente de reconciliação; avise a equipe do servidor.`;
    }
    return `${emoji.clock} O Discord não confirmou a aplicação. Mantive a compra pendente para proteger seu saldo.`;
  }

  const completed = rolePurchases.completeRolePurchase(reservation.reservation.id);
  if (!completed) return `${emoji.clock} Cargo aplicado; o registro será reconciliado automaticamente.`;
  return `${emoji.correct} ${role} comprado e aplicado!` +
    (completed.expiresAt ? ` Válido até ${timestamp(completed.expiresAt)}.` : "");
}

function discordErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = Number(error.code);
  return Number.isInteger(code) ? code : undefined;
}
