import { defineCommand } from "../types/command";
const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js") as typeof import("discord.js");

const emoji = require("../utils/emojis");
const {
  getNetProfit,
  getProfile,
  transfer,
} = require("../utils/cookieEconomy");
const {
  buildInlineErrorEmbed,
} = require("../utils/cookieViews");

const cookieEmoji = () => emoji.cookie;

function amount(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function buildContext(interaction) {
  return {
    guildId: interaction.guild?.id,
    guildName: interaction.guild?.name,
  };
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
    .setName("cookies")
    .setDescription("Economia global de cookies")
    .addSubcommand(subcommand =>
      subcommand
        .setName("saldo")
        .setDescription("Mostra o saldo global de cookies")
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Usuário para consultar")
            .setRequired(false)
        )
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "saldo") {
      const user = interaction.options.getUser("usuario") || interaction.user;
      const profile = getProfile(user);
      const netProfit = getNetProfit(profile);

      const embed = new EmbedBuilder()
        .setColor(0xf5a623)
        .setAuthor({
          name: `Carteira de ${user.username}`,
          iconURL: user.displayAvatarURL({ size: 64 }),
        })
        .setTitle(`${cookieEmoji()} Saldo de Cookies`)
        .setThumbnail(emojiImageUrl(emoji.cookie) || user.displayAvatarURL({ size: 256 }))
        .setDescription(
          [
            `${emoji.online} \u00bb Usuário: <@${user.id}>`,
            `${cookieEmoji()} \u00bb Saldo atual: **${amount(profile.balance)} cookies**`,
          ].join("\n")
        )
        .addFields(
          {
            name: `${emoji.clipboard} Movimentação`,
            value: [
              `Ganhos totais: **${amount(profile.totalEarned)}**`,
              `Gastos e perdas: **${amount(profile.totalSpent)}**`,
              `Resultado em jogos: **${amount(netProfit)}**`,
            ].join("\n"),
            inline: false,
          },
          {
            name: `${emoji.keyboardWumpus} Jogos`,
            value: [
              `Vitorias: **${amount(profile.betWins)}**`,
              `Derrotas: **${amount(profile.betLosses)}**`,
              `Empates: **${amount(profile.draws)}**`,
              `Partidas: **${amount(profile.gamesPlayed)}**`,
            ].join("\n"),
            inline: true,
          },
          {
            name: `${emoji.calendar} Daily`,
            value: [
              `Sequencia: **${amount(profile.dailyStreak)}**`,
              `Melhor: **${amount(profile.bestDailyStreak)}**`,
              `Coletas: **${amount(profile.dailyClaims)}**`,
            ].join("\n"),
            inline: true,
          },
          {
            name: `${emoji.booster} Taxa diária`,
            value: "1% ao dia apenas sobre saldo acima de **500 cookies**. Limite: **250 cookies/dia**.",
            inline: false,
          }
        )
        .setFooter({
          text: interaction.client.user?.username || "Bot",
          iconURL: interaction.client.user?.displayAvatarURL() || undefined,
        })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    return interaction.reply({
      content: "Subcomando desconhecido.",
      flags: 64,
    });
  },
});
