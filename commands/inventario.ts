const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { SHOP_ITEMS_BY_ID } = require("../utils/cookieShop");
const {
  getNetProfit,
  getProfile,
  getShopInventory,
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

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("inventario")
    .setDescription("Mostra seu inventário de cookies")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário para consultar")
        .setRequired(false)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("usuario") || interaction.user;
    const profile = getProfile(user);
    const inventory = getShopInventory(user.id);
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
      : "Nenhuma ainda. Use `/loja` para ver as cores.";
    const chestCollection = chests.length
      ? chests.map(item => `${item.name} × ${item.quantity}`).join("\n")
      : "Nenhum baú guardado.";
    const utilityCollection = utilityItems.length
      ? utilityItems.map(item => `${item.name} × ${item.quantity}`).join("\n")
      : "Nenhum passe guardado.";
    const boostCollection = boostItems.length
      ? boostItems.map(item => `${item.name} × ${item.quantity}`).join("\n")
      : "Nenhum boost guardado.";

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
          `${emoji.clap} \u00bb Ganhos totais: **${amount(profile.totalEarned)} cookies**`,
          `${emoji.peepSad} \u00bb Perdidos/gastos: **${amount(profile.totalSpent)} cookies**`,
          `${emoji.ticket} \u00bb Lucro em jogos: **${amount(getNetProfit(profile))} cookies**`,
          "",
          `${emoji.work} \u00bb Trabalhos feitos: **${amount(profile.workCount)}**`,
          `${emoji.gift} \u00bb Recompensas diárias: **${amount(profile.dailyClaims)}**`,
        ].join("\n")
      )
      .addFields({
        name: `${emoji.settingsIcon} Cores (${ownedColors.length})`,
        value: `Equipada: **${selectedTheme?.name || "Clássico"}**\n${colorCollection}`,
      }, {
        name: `${emoji.owner} VIP`,
        value: profile.isVip
          ? "Ativo permanentemente · +10% nas recompensas elegíveis."
          : "Não adquirido. Consulte `/loja`.",
        inline: true,
      }, {
        name: `${emoji.booster} Boosts`,
        value: `${profile.cookieBoostUntil > Date.now() ? `Ativo até <t:${Math.floor(profile.cookieBoostUntil / 1000)}:R>` : "Nenhum boost ativo."}\n${boostCollection}`,
        inline: true,
      }, {
        name: `${emoji.gift} Baús`,
        value: chestCollection,
        inline: true,
      }, {
        name: `${emoji.clock} Utilidades`,
        value: utilityCollection,
        inline: true,
      })
      .setFooter({
        text: interaction.client.user?.username || "Bot",
        iconURL: interaction.client.user?.displayAvatarURL() || undefined,
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
