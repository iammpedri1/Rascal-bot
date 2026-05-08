const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const {
  getNetProfit,
  getProfile,
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
    .setDescription("Mostra seu inventario de cookies")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuario para consultar")
        .setRequired(false)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("usuario") || interaction.user;
    const profile = getProfile(user);

    const embed = new EmbedBuilder()
      .setColor(0xf5a623)
      .setTitle(`${emoji.cookie} Inventario de Cookies`)
      .setAuthor({
        name: user.username,
        iconURL: user.displayAvatarURL({ size: 64 }),
      })
      .setThumbnail(emojiImageUrl(emoji.cookie) || user.displayAvatarURL({ size: 256 }))
      .setDescription(
        [
          `${emoji.cookie} \u00bb Carteira: **${amount(profile.balance)} cookies**`,
          `\u2764\uFE0F \u00bb Reputacao: **${amount(profile.repsReceived)}**`,
          "",
          `${emoji.clap} \u00bb Ganhos totais: **${amount(profile.totalEarned)} cookies**`,
          `${emoji.peepSad} \u00bb Perdidos/gastos: **${amount(profile.totalSpent)} cookies**`,
          `${emoji.ticket} \u00bb Lucro em jogos: **${amount(getNetProfit(profile))} cookies**`,
          "",
          `${emoji.work} \u00bb Trabalhos feitos: **${amount(profile.workCount)}**`,
          `${emoji.gift} \u00bb Recompensas diarias: **${amount(profile.dailyClaims)}**`,
        ].join("\n")
      )
      .setFooter({
        text: interaction.client.user?.username || "Bot",
        iconURL: interaction.client.user?.displayAvatarURL() || undefined,
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
