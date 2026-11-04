import { defineCommand } from "../types/command";
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js") as typeof import("discord.js");

const emoji = require("../utils/emojis");
const { SHOP_ITEMS_BY_ID } = require("../utils/cookieShop");
const {
  getNetProfit,
  getProfile,
  getShopInventory,
  getGuildShopRolePurchases,
} = require("../utils/cookieEconomy");

function amount(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function emojiImageUrl(customEmoji) {
  const match = customEmoji?.match(/^<a?:[^:]+:(\d+)>$/);
  if (!match) return null;

  const extension = customEmoji.startsWith("<a:") ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${match[1]}.${extension}?quality=lossless`;
}

module.exports = defineCommand({
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("inventario")
    .setDescription("Exibe seu inventário pessoal e estatísticas de cookies")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário para consulta")
        .setRequired(false)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("usuario") || interaction.user;
    const profile = getProfile(user);
    const inventory = getShopInventory(user.id);
    const guildRolePurchases = interaction.guild
      ? getGuildShopRolePurchases(interaction.guildId, user.id)
      : [];
    const ownedColors = inventory
      .map(entry => SHOP_ITEMS_BY_ID[entry.itemId])
      .filter(item => item?.kind === "color");
    const chests = inventory
      .map(entry => ({ ...SHOP_ITEMS_BY_ID[entry.itemId], quantity: entry.quantity }))
      .filter(item => item?.kind === "chest");
    const utilityItems = inventory
      .map(entry => ({ ...SHOP_ITEMS_BY_ID[entry.itemId], quantity: entry.quantity }))
      .filter(item => item?.kind === "cooldown_pass");
    const boostItems = inventory
      .map(entry => ({ ...SHOP_ITEMS_BY_ID[entry.itemId], quantity: entry.quantity }))
      .filter(item => item?.kind === "cookie_boost");
    const selectedTheme = SHOP_ITEMS_BY_ID[profile.selectedBanner];
    const colorCollection = ownedColors.length
      ? ownedColors.map(item => item.name).join(" · ")
      : "Nenhum item adquirido. Utilize `/loja` para explorar as opções disponíveis.";
    const chestCollection = chests.length
      ? chests.map(item => `${item.name} × ${item.quantity}`).join("\n")
      : "Nenhum baú disponível no inventário.";
    const utilityCollection = utilityItems.length
      ? utilityItems.map(item => `${item.name} × ${item.quantity}`).join("\n")
      : "Nenhum passe disponível no inventário.";
    const boostCollection = boostItems.length
      ? boostItems.map(item => `${item.name} × ${item.quantity}`).join("\n")
      : "Nenhum acelerador disponível no inventário.";

    const embed = new EmbedBuilder()
      .setColor(selectedTheme?.color || 0xf5a623)
      .setTitle(`${emoji.cookie} Inventário de Cookies`)
      .setAuthor({
        name: user.username,
        iconURL: user.displayAvatarURL({ size: 64 }),
      })
      .setThumbnail(emojiImageUrl(emoji.cookie) || user.displayAvatarURL({ size: 256 }))
      .setDescription(
        [
          `${emoji.cookie} \u00bb Carteira: **${amount(profile.balance)} cookies**`,
          `\u2764\uFE0F \u00bb Reputação: **${amount(profile.repsReceived)}**`,
          "",
          `${emoji.clap} \u00bb Rendimento total: **${amount(profile.totalEarned)} cookies**`,
          `${emoji.peepSad} \u00bb Despesas e perdas: **${amount(profile.totalSpent)} cookies**`,
          `${emoji.ticket} \u00bb Resultado em apostas: **${amount(getNetProfit(profile))} cookies**`,
          "",
          `${emoji.work} \u00bb Atividades concluídas: **${amount(profile.workCount)}**`,
          `${emoji.gift} \u00bb Resgates diários: **${amount(profile.dailyClaims)}**`,
        ].join("\n")
      )
      .addFields({
        name: `${emoji.settingsIcon} Paleta de Cores (${ownedColors.length})`,
        value: `Equipada: **${selectedTheme?.name || "Clássico"}**\n${colorCollection}`,
      }, {
        name: `${emoji.owner} VIP`,
        value: profile.isVip
          ? "Benefício Vitalício · Adicional de 10% em recompensas qualificadas."
          : "Benefício não ativo. Consulte `/loja`.",
        inline: true,
      }, {
        name: `${emoji.booster} Boosts`,
        value: `${profile.cookieBoostUntil > Date.now() ? `Ativo até <t:${Math.floor(profile.cookieBoostUntil / 1000)}:R>` : "Nenhum acelerador ativo no momento."}\n${boostCollection}`,
        inline: true,
      }, {
        name: `${emoji.gift} Baús`,
        value: chestCollection,
        inline: true,
      }, {
        name: `${emoji.clock} Utilidades`,
        value: utilityCollection,
        inline: true,
      }, {
        name: `${emoji.roles} Aquisições de Cargos no Servidor`,
        value: guildRolePurchases.length
          ? guildRolePurchases.map(purchase => {
            const role = interaction.guild.roles.cache.get(purchase.roleId);
            const roleName = role ? role.toString() : "cargo removido do servidor";
            const kind = purchase.kind === "vip" ? "VIP" : "Cor";
            const expiry = purchase.expiresAt
              ? ` · expira <t:${Math.floor(purchase.expiresAt / 1000)}:R>`
              : " · permanente";
            return `• ${kind}: ${roleName}${expiry}`;
          }).join("\n").slice(0, 1000)
          : "Nenhuma aquisição de cargo registrada nesta loja.",
        inline: false,
      })
      .setFooter({
        text: interaction.client.user?.username || "Bot",
        iconURL: interaction.client.user?.displayAvatarURL() || undefined,
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
});
