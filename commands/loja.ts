const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");
const cooldowns = require("../utils/cooldowns");
const { COOLDOWN_TARGETS, SHOP_ITEMS_BY_ID, SHOP_SECTIONS } = require("../utils/cookieShop");
const {
  activateCookieBoost,
  equipShopItem,
  getProfile,
  getShopInventory,
  openShopChest,
  purchaseShopItem,
  useShopCooldownPass,
} = require("../utils/cookieEconomy");

const COLOR_DEFAULT = {
  id: "default",
  kind: "color",
  name: "Clássico",
  emoji: emoji.cookie,
  description: "Restaure a cor original do seu inventário.",
  price: 0,
  color: 0xf5a623,
};

function parseEmoji(value) {
  const match = String(value || "").match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
  if (!match) return value;

  return { name: match[1], id: match[2], animated: value.startsWith("<a:") };
}

function amount(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function timestamp(ms) {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("loja")
    .setDescription("Compre cores, VIP, boosts, caixas e removedores de cooldown"),

  async execute(interaction) {
    let sectionId = "cores";
    let selectedId = SHOP_SECTIONS[0].items[0].id;
    let selectedCooldown = null;
    let notice = "";
    let profile = getProfile(interaction.user);
    let inventory = getShopInventory(interaction.user.id);
    const serverColorRoles = interaction.guild
      ? interaction.guild.roles.cache
        .filter(role => role.name !== "@everyone" && role.color !== 0)
        .sort((a, b) => b.position - a.position)
        .first(10)
      : [];

    const section = () => SHOP_SECTIONS.find(entry => entry.id === sectionId) || SHOP_SECTIONS[0];
    const item = () => {
      if (sectionId === "cores" && selectedId === "default") return COLOR_DEFAULT;
      return section().items.find(entry => entry.id === selectedId) || section().items[0];
    };
    const quantityOf = id => inventory.find(entry => entry.itemId === id)?.quantity || 0;
    const findActiveCooldown = () => COOLDOWN_TARGETS.find(target =>
      !cooldowns.check(interaction.user.id, target.id).ready
    );
    const refresh = () => {
      profile = getProfile(interaction.user);
      inventory = getShopInventory(interaction.user.id);
    };

    const buildEmbed = () => {
      const current = item();
      const stock = quantityOf(current.id);
      const equipped = current.kind === "color" && profile.selectedBanner === current.id;
      const fields = [{
        name: `${emoji.cookie} Saldo`,
        value: `**${amount(profile.balance)} cookies**`,
        inline: true,
      }, {
        name: "Valor",
        value: current.price ? `**${amount(current.price)} cookies**` : "Grátis",
        inline: true,
      }];
      if (sectionId === "cores" && serverColorRoles.length) {
        fields.push({
          name: "Cargos de cor do servidor",
          value: serverColorRoles.map(role => `${role} \`${role.name}\``).join("\n").slice(0, 1024),
          inline: false,
        });
      }
      if (sectionId === "vip") {
        fields.push({
          name: "Status VIP",
          value: profile.isVip ? "VIP ativo na sua conta." : "VIP ainda não adquirido.",
          inline: false,
        });
      }

      let status;
      if (current.kind === "color") {
        status = current.id === "default"
          ? (equipped ? "A cor clássica já está selecionada." : "Selecione para restaurar a cor original.")
          : equipped
            ? "Esta cor está equipada."
            : stock
              ? "Cor permanente na sua coleção."
              : "Disponível para compra permanente.";
        fields.push({
          name: "Coleção",
          value: `${inventory.filter(entry => SHOP_ITEMS_BY_ID[entry.itemId]?.kind === "color").length} cores · equipada: **${profile.selectedBanner === "default" ? "Clássico" : (SHOP_ITEMS_BY_ID[profile.selectedBanner]?.name || "Clássico")}**`,
          inline: true,
        });
      } else if (current.kind === "vip") {
        status = profile.isVip
          ? "VIP permanente ativo na sua conta."
          : "Compra única. O benefício não expira.";
        fields.push({
          name: "Benefício",
          value: "**+10%** em recompensas de `/daily`, `/trabalhar`, `/bonus` e caixas.",
          inline: true,
        });
      } else if (current.kind === "cookie_boost") {
        const active = profile.cookieBoostUntil > Date.now();
        status = active
          ? `Boost ativo até ${timestamp(profile.cookieBoostUntil)}. Ativações extras estendem a duração.`
          : "Sem boost ativo no momento.";
        fields.push({
          name: "No inventário",
          value: `**${stock}** boost${stock === 1 ? "" : "s"}`,
          inline: true,
        });
      } else if (current.kind === "chest") {
        status = `Você tem **${stock}** caixa${stock === 1 ? "" : "s"} deste tipo.`;
        fields.push({
          name: "Possíveis recompensas",
          value: `${amount(current.minReward)}–${amount(current.maxReward)} cookies${current.colorDropChance ? `\nChance de cor: **${percent(current.colorDropChance)}**` : ""}`,
          inline: true,
        });
      } else {
        const target = COOLDOWN_TARGETS.find(entry => entry.id === selectedCooldown);
        const cooldown = target ? cooldowns.check(interaction.user.id, target.id) : null;
        status = `Passes no inventário: **${stock}**.`;
        if (!target) status += " Escolha qual cooldown deseja liberar.";
        else if (!cooldown || cooldown.ready) status += ` **${target.name}** já está liberado.`;
        else status += ` **${target.name}** tem mais **${cooldowns.formatDuration(cooldown.remaining)}**.`;
        fields.push({
          name: "Como funciona",
          value: "Remove um cooldown ativo. O item não é consumido se o tempo já terminou.",
          inline: true,
        });
      }

      return new EmbedBuilder()
        .setColor(current.color)
        .setAuthor({
          name: `${interaction.client.user.username} · Loja de itens`,
          iconURL: interaction.client.user.displayAvatarURL({ size: 128 }),
        })
        .setTitle(`${section().emoji} Loja de itens`)
        .setDescription([
          `**${section().name}**`,
          section().description,
          "",
          `${current.emoji} **${current.name}**`,
          current.description,
          "",
          status,
          notice,
        ].filter(Boolean).join("\n"))
        .addFields(fields)
        .setFooter({ text: "VIP e boosts aumentam recompensas de atividades; compras e transferências não recebem bônus." })
        .setTimestamp();
    };

    const buildComponents = () => {
      const currentSection = section();
      const current = item();
      const stock = quantityOf(current.id);
      const rows = [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("loja|secao")
            .setPlaceholder("Escolha uma categoria")
            .addOptions(SHOP_SECTIONS.map(entry => ({
              label: entry.name,
              description: entry.description,
              value: entry.id,
              emoji: parseEmoji(entry.emoji),
              default: sectionId === entry.id,
            })))
        ),
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("loja|item")
            .setPlaceholder(`Escolha em ${currentSection.name.toLowerCase()}`)
            .addOptions([
              ...(sectionId === "cores" ? [{
                label: COLOR_DEFAULT.name,
                description: "Grátis · restaurar a cor original",
                value: COLOR_DEFAULT.id,
                emoji: parseEmoji(COLOR_DEFAULT.emoji),
                default: selectedId === COLOR_DEFAULT.id,
              }] : []),
              ...currentSection.items.map(entry => ({
                label: entry.name,
                description: `${amount(entry.price)} cookies · ${entry.kind === "color" || entry.kind === "vip" ? "permanente" : "consumível"}`,
                value: entry.id,
                emoji: parseEmoji(entry.emoji),
                default: selectedId === entry.id,
              })),
            ])
        ),
      ];

      if (current.kind === "cooldown_pass") {
        rows.push(new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("loja|alvo")
            .setPlaceholder("Escolha um cooldown para liberar")
            .addOptions(COOLDOWN_TARGETS.map(target => {
              const state = cooldowns.check(interaction.user.id, target.id);
              return {
                label: target.name,
                description: state.ready ? "Já está liberado" : `Faltam ${cooldowns.formatDuration(state.remaining)}`,
                value: target.id,
                emoji: parseEmoji(target.emoji),
                default: selectedCooldown === target.id,
              };
            }))
        ));
      }

      const actions = new ActionRowBuilder();
      if (current.kind === "color") {
        if (current.id !== "default") {
          actions.addComponents(new ButtonBuilder()
            .setCustomId("loja|comprar")
            .setLabel("Comprar cor")
            .setEmoji(parseEmoji(emoji.shop))
            .setStyle(ButtonStyle.Success)
            .setDisabled(stock > 0 || profile.balance < current.price));
        }
        actions.addComponents(new ButtonBuilder()
          .setCustomId("loja|equipar")
          .setLabel(current.id === "default" ? "Voltar ao clássico" : "Equipar")
          .setEmoji(parseEmoji(emoji.roles))
          .setStyle(ButtonStyle.Primary)
          .setDisabled((current.id !== "default" && stock === 0) || equippedColor(profile, current.id)));
      } else if (current.kind === "vip") {
        actions.addComponents(new ButtonBuilder()
          .setCustomId("loja|comprar")
          .setLabel(profile.isVip ? "VIP permanente ativo" : "Comprar VIP")
          .setEmoji(parseEmoji(emoji.owner))
          .setStyle(ButtonStyle.Success)
          .setDisabled(profile.isVip || profile.balance < current.price));
      } else if (current.kind === "cookie_boost") {
        actions.addComponents(
          new ButtonBuilder()
            .setCustomId("loja|comprar")
            .setLabel("Comprar boost")
            .setEmoji(parseEmoji(emoji.shop))
            .setStyle(ButtonStyle.Success)
            .setDisabled(profile.balance < current.price),
          new ButtonBuilder()
            .setCustomId("loja|ativar")
            .setLabel("Ativar / estender")
            .setEmoji(parseEmoji(emoji.booster))
            .setStyle(ButtonStyle.Primary)
            .setDisabled(stock === 0)
        );
      } else if (current.kind === "chest") {
        actions.addComponents(
          new ButtonBuilder()
            .setCustomId("loja|comprar")
            .setLabel("Comprar caixa")
            .setEmoji(parseEmoji(emoji.shop))
            .setStyle(ButtonStyle.Success)
            .setDisabled(profile.balance < current.price),
          new ButtonBuilder()
            .setCustomId("loja|abrir")
            .setLabel("Abrir caixa")
            .setEmoji(parseEmoji(emoji.gift))
            .setStyle(ButtonStyle.Primary)
            .setDisabled(stock === 0)
        );
      } else {
        const targetReady = selectedCooldown
          ? cooldowns.check(interaction.user.id, selectedCooldown).ready
          : true;
        actions.addComponents(
          new ButtonBuilder()
            .setCustomId("loja|comprar")
            .setLabel("Comprar passe")
            .setEmoji(parseEmoji(emoji.shop))
            .setStyle(ButtonStyle.Success)
            .setDisabled(profile.balance < current.price),
          new ButtonBuilder()
            .setCustomId("loja|usar")
            .setLabel("Remover cooldown")
            .setEmoji(parseEmoji(emoji.clock))
            .setStyle(ButtonStyle.Primary)
            .setDisabled(stock === 0 || !selectedCooldown || targetReady)
        );
      }

      actions.addComponents(new ButtonBuilder()
        .setCustomId("loja|fechar")
        .setLabel("Fechar")
        .setEmoji(parseEmoji(emoji.crossed))
        .setStyle(ButtonStyle.Secondary));
      rows.push(actions);
      return rows;
    };

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const message = await interaction.editReply({ embeds: [buildEmbed()], components: buildComponents() });
    const collector = message.createMessageComponentCollector({ time: 180000 });

    collector.on("collect", async componentInteraction => {
      if (componentInteraction.user.id !== interaction.user.id) {
        return componentInteraction.reply({
          content: "Esta loja está aberta para outra pessoa.",
          flags: MessageFlags.Ephemeral,
        });
      }

      notice = "";
      const id = componentInteraction.customId;
      if (componentInteraction.componentType === ComponentType.StringSelect) {
        if (id === "loja|secao") {
          sectionId = componentInteraction.values[0];
          selectedId = section().items[0].id;
          selectedCooldown = sectionId === "utilidades" ? findActiveCooldown()?.id || null : null;
        } else if (id === "loja|item") {
          selectedId = componentInteraction.values[0];
          if (SHOP_ITEMS_BY_ID[selectedId]?.kind === "cooldown_pass" && !selectedCooldown) {
            selectedCooldown = findActiveCooldown()?.id || null;
          }
        } else if (id === "loja|alvo") {
          selectedCooldown = componentInteraction.values[0];
        }
      } else if (id === "loja|comprar") {
        const result = purchaseShopItem(interaction.user, selectedId, {
          guildId: interaction.guildId,
          guildName: interaction.guild?.name,
        });
        if (result.ok) notice = `${emoji.correct} **${result.item.name}** comprado.`;
        else if (result.reason === "balance") notice = `${emoji.redTick} Saldo insuficiente para esta compra.`;
        else if (result.reason === "owned") notice = `${emoji.thinking} Você já possui este item permanente.`;
        refresh();
      } else if (id === "loja|equipar") {
        const result = equipShopItem(interaction.user, selectedId);
        if (result.ok) {
          profile = result.profile;
          notice = `${emoji.correct} Tema aplicado ao inventário.`;
        } else notice = `${emoji.redTick} Compre esta cor antes de equipá-la.`;
      } else if (id === "loja|ativar") {
        const result = activateCookieBoost(interaction.user, selectedId, {
          guildId: interaction.guildId,
          guildName: interaction.guild?.name,
        });
        if (result.ok) notice = `${emoji.correct} Boost ativo até ${timestamp(result.expiresAt)}.`;
        else notice = `${emoji.redTick} Você não tem um boost no inventário.`;
        refresh();
      } else if (id === "loja|abrir") {
        const result = openShopChest(interaction.user, selectedId, {
          guildId: interaction.guildId,
          guildName: interaction.guild?.name,
        });
        if (result.ok) {
          const colorText = result.colorReward
            ? `\nCor liberada: **${result.colorReward.name}**.`
            : result.duplicateColorBonus
              ? `\nColeção completa: bônus de **${amount(result.duplicateColorBonus)} cookies**.`
              : "";
          notice = `${emoji.correct} Caixa aberta: **${amount(result.cookieReward)} cookies**.${colorText}`;
        } else notice = `${emoji.redTick} Você não tem esta caixa no inventário.`;
        refresh();
      } else if (id === "loja|usar") {
        const result = useShopCooldownPass(interaction.user, selectedId, selectedCooldown, {
          guildId: interaction.guildId,
          guildName: interaction.guild?.name,
        });
        if (result.ok) {
          const target = COOLDOWN_TARGETS.find(entry => entry.id === result.target);
          notice = `${emoji.correct} **${target?.name || result.target}** liberado; restavam ${cooldowns.formatDuration(result.remaining)}.`;
        } else if (result.reason === "cooldown_ready") {
          notice = `${emoji.thinking} Este comando já está liberado; o passe não foi consumido.`;
        } else notice = `${emoji.redTick} Você precisa ter um removedor de cooldown.`;
        refresh();
      } else if (id === "loja|fechar") {
        collector.stop("closed");
        return componentInteraction.update({ components: [] });
      }

      return componentInteraction.update({ embeds: [buildEmbed()], components: buildComponents() });
    });

    collector.on("end", () => {
      message.edit({ components: [] }).catch(() => {});
    });
  },
};

function equippedColor(profile, id) {
  return profile.selectedBanner === id;
}
