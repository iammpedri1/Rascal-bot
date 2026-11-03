import { defineCommand } from "../types/command";
import type { GuildMember, Role } from "discord.js";
import type { ShopRoleOffer, ShopRoleKind } from "../utils/shopRolePurchases";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

const emoji = require("../utils/emojis") as typeof import("../utils/emojis");
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
  const match = offer.name.match(/(?:^|\\D)(\\d{1,2})(?:\\D|$)/);
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
  const buttons = sections.map((section) => {
    const config = section.id === "cores"
      ? { emoji: "palette", fallback: "🎨" }
      : section.id === "vip"
        ? { emoji: "owner", fallback: "👑" }
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
    if (assigned) return `${emoji.application("correct", "✅")} já aplicada`;
    if (purchase) return `${emoji.application("correct", "✅")} sua; clique para reaplicar sem pagar`;
    return `${emoji.application("cookie", "🍪")} ${amount(offer.price)} cookies`;
  }

  const active = Number(purchase?.expiresAt) > Date.now();
  if (active && assigned) return `${emoji.application("clock", "⏰")} ativa até ${timestamp(purchase.expiresAt)} · clique para renovar`;
  if (active) return `${emoji.application("correct", "✅")} ativa até ${timestamp(purchase.expiresAt)} · reaplicar sem pagar`;
  if (purchase) return `${emoji.application("clock", "⏰")} expirada · ${amount(offer.price)} cookies / 30 dias`;
  if (assigned) return `${emoji.application("correct", "✅")} você já tem este cargo`;
  return `${emoji.application("cookie", "🍪")} ${amount(offer.price)} cookies / 30 dias`;
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
      ? `\n   ${vipBenefitsFor(offer)}`
      : "";
    return `${emoji.application("next", "›")} **${label}** » ${offer.mention}\n   ${roleStatus(kind, offer, assigned, purchase)}${details}`;
  });

  const title = kind === "color" ? "Cores do servidor" : "VIPs do servidor";
  const description = offers.length
    ? [
      kind === "color"
        ? "Escolha um número para comprar o cargo de cor e aplicá-lo ao seu perfil."
        : "Star VIP, Elite VIP e Super VIP, com bônus de cookies.",
      "",
      ...lines,
      "",
      `${emoji.application("cookie", "🍪")} Seu saldo: **${amount(profile.balance)} cookies**`,
      notice,
    ].filter(Boolean).join("\n")
    : [
      kind === "color"
        ? "Não encontrei cargos de cor disponíveis. Os cargos numerados de cor do servidor serão detectados automaticamente."
        : "Não encontrei os cargos Star VIP, Elite VIP ou Super VIP disponíveis. Confira se os nomes estão corretos e se o cargo do Rascal está acima deles.",
      "",
      `${emoji.application("cookie", "🍪")} Seu saldo: **${amount(profile.balance)} cookies**`,
      notice,
    ].filter(Boolean).join("\n");

  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setAuthor({ name: `${interaction.guild.name} · Loja do Rascal` })
    .setTitle(`${emoji.application(kind === "color" ? "palette" : "owner", kind === "color" ? "🎨" : "👑")} ${title}`)
    .setDescription(description);

  return { embed, offers, page: currentPage, pages, visible, profile };
}

function buildHomeEmbed(interaction, notice: string) {
  const profile = getProfile(interaction.user);
  return new EmbedBuilder()
    .setColor(randomColor())
    .setAuthor({ name: `Loja de ${interaction.guild.name}` })
    .setTitle(`${emoji.application("shop", "🛍️")} Loja do Rascal`)
    .setDescription([
      "Escolha uma categoria. A loja usa os cargos e os cooldowns deste servidor.",
      "",
      `${emoji.application("palette", "🎨")} **CORES**\n↳ Cargos numerados de cor encontrados no servidor.`,
      `${emoji.application("owner", "👑")} **VIPs**\n↳ Star VIP, Elite VIP e Super VIP disponíveis neste servidor.`,
      `${emoji.application("clock", "⏳")} **ACELERADORES**\n↳ Libere Daily, Roubar ou Trabalhar antes do cooldown.`,
      "",
      `${emoji.application("cookie", "🍪")} Seu saldo: **${amount(profile.balance)} cookies**`,
      notice,
    ].filter(Boolean).join("\n\n"));
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
    return `${emoji.application(offer.emoji, offer.fallback)} **${offer.label}** — **${amount(offer.price)} cookies**${ready ? `\n   ${state}` : "\n   sem cooldown ativo"}`;
  });

  return new EmbedBuilder()
    .setColor(randomColor())
    .setAuthor({ name: `Aceleradores · ${interaction.guild.name}` })
    .setTitle(`${emoji.application("clock", "⏳")} Aceleradores de tempo`)
    .setDescription([
      "Compre apenas quando houver cooldown ativo. Os cookies são descontados e o cooldown real é liberado imediatamente.",
      "",
      ...lines,
      "",
      `${emoji.application("cookie", "🍪")} Seu saldo: **${amount(profile.balance)} cookies**`,
      notice,
    ].filter(Boolean).join("\n\n"));
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
    rows.push(new ActionRowBuilder().addComponents(...ACCELERATORS.map((offer) => {
      const hasCooldown = offer.targets.some((target) => !cooldowns.check(interaction.user.id, target).ready);
      const canAfford = getProfile(interaction.user).balance >= offer.price;
      return buttonEmoji(new ButtonBuilder()
        .setCustomId(`loja|acelerador|${offer.id}`)
        .setLabel(`${offer.label} · ${amount(offer.price)}`)
        .setStyle(offer.id === "todos" ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(!hasCooldown || !canAfford), offer.emoji, offer.fallback);
    })));
    rows.push(navigationRow(sectionId, 0, 1));
    return rows;
  }

  return [categoryRow(interaction, sectionId)];
}

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("loja")
    .setDescription("Compre cargos de cor, VIPs e aceleradores do servidor"),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use /loja dentro do servidor.", flags: MessageFlags.Ephemeral });
    }
    if (!PRIMARY_GUILD_ID || interaction.guildId !== PRIMARY_GUILD_ID) {
      return interaction.reply({ content: "A loja do Rascal está disponível apenas no servidor oficial.", flags: MessageFlags.Ephemeral });
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
      const isPurchase = id.startsWith("loja|cargo|") || id.startsWith("loja|acelerador|");
      if (isPurchase && activePurchaseUsers.has(component.user.id)) {
        await component.reply({ content: `${emoji.application("clock", "⏳")} Sua outra compra ainda está sendo processada. Aguarde.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (isPurchase) activePurchaseUsers.add(component.user.id);

      try {
        await component.deferUpdate();
        notice = "";

        if (id.startsWith("loja|categoria|")) {
          const selected = id.split("|")[2];
          if (SHOP_SECTIONS.some((entry) => entry.id === selected)) {
            sectionId = selected;
            page = 0;
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
            notice = `${emoji.application("redTick", "❌")} Esse cargo não está mais disponível na loja.`;
          } else {
            notice = await processGuildRolePurchase(component, member, role, offer);
          }
        } else if (id.startsWith("loja|acelerador|")) {
          const offer = ACCELERATORS.find((entry) => entry.id === id.split("|")[2]);
          if (!offer) {
            notice = `${emoji.application("redTick", "❌")} Esse acelerador não existe.`;
          } else {
            const result = purchaseCooldownUnlock(interaction.user, offer.targets, offer.price, {
              guildId: interaction.guildId,
              guildName: interaction.guild.name,
            });
            if (result.ok) notice = `${emoji.application("correct", "✅")} Cooldown liberado: ${result.targets.map((target) => `/${target}`).join(", ")}.`;
            else if (result.reason === "balance") notice = `${emoji.application("redTick", "❌")} Saldo insuficiente para esse acelerador.`;
            else if (result.reason === "cooldown_ready") notice = `${emoji.application("thinking", "🤔")} Esse cooldown já está liberado.`;
            else notice = `${emoji.application("redTick", "❌")} Não consegui aplicar esse acelerador.`;
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
          content: `${emoji.application("redTick", "❌")} Não consegui concluir a ação. Tente novamente.`,
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
    return `${emoji.application("thinking", "🤔")} Você já está usando essa cor; nenhum cookie foi cobrado.`;
  }
  if (alreadyAssigned && offer.kind === "vip" && !existing) {
    return `${emoji.application("thinking", "🤔")} Você já possui esse VIP; nenhum cookie foi cobrado.`;
  }

  const activePurchase = existing && (offer.kind === "color" || Number(existing.expiresAt) > Date.now());
  if (!alreadyAssigned && activePurchase) {
    try {
      await member.roles.add(role, "Reaplicação de um cargo comprado na loja");
      return `${emoji.application("correct", "✅")} Cargo ${role} reaplicado sem nova cobrança.`;
    } catch (error) {
      logger.error("Falha ao reaplicar cargo comprado", error, { roleId: role.id, userId: interaction.user.id });
      return discordErrorCode(error) === 50013
        ? `${emoji.application("redTick", "❌")} Não consigo aplicar o cargo. A equipe precisa mover o cargo do Rascal acima dele.`
        : `${emoji.application("redTick", "❌")} Não consegui aplicar o cargo agora.`;
    }
  }

  const reservation = rolePurchases.reserveRolePurchase(
    { id: interaction.user.id, username: interaction.user.username },
    offer,
    { guildId: interaction.guildId, guildName: interaction.guild.name },
  );
  if (reservation.ok === false) {
    if (reservation.reason === "balance") return `${emoji.application("redTick", "❌")} Você precisa de ${amount(offer.price)} cookies para comprar esse cargo.`;
    if (reservation.reason === "owned") return `${emoji.application("thinking", "🤔")} Essa cor já está registrada na sua coleção.`;
    if (reservation.reason === "busy") return `${emoji.application("clock", "⏳")} Sua outra compra ainda está sendo processada.`;
    return `${emoji.application("redTick", "❌")} Não consegui concluir essa compra.`;
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
      return `${emoji.application("correct", "✅")} Cargo aplicado e compra registrada.`;
    }
    if (applied === false) {
      const refunded = rolePurchases.refundRolePurchase(reservation.reservation.id, "Discord recusou a aplicação do cargo");
      return refunded
        ? `${emoji.application("redTick", "❌")} A compra foi cancelada e os cookies devolvidos. Confira se o cargo do Rascal está acima do cargo da loja.`
        : `${emoji.application("redTick", "❌")} O estorno está pendente de reconciliação; avise a equipe do servidor.`;
    }
    return `${emoji.application("clock", "⏳")} O Discord não confirmou a aplicação. Mantive a compra pendente para proteger seu saldo.`;
  }

  const completed = rolePurchases.completeRolePurchase(reservation.reservation.id);
  if (!completed) return `${emoji.application("clock", "⏳")} Cargo aplicado; o registro será reconciliado automaticamente.`;
  return `${emoji.application("correct", "✅")} ${role} comprado e aplicado!` +
    (completed.expiresAt ? ` Válido até ${timestamp(completed.expiresAt)}.` : "");
}

function discordErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = Number(error.code);
  return Number.isInteger(code) ? code : undefined;
}
