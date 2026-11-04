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
    .setDescription("Gestão da Economia Global de Cookies")
    .addSubcommand(subcommand =>
      subcommand
        .setName("saldo")
        .setDescription("Consulta o saldo global de cookies")
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Usuário para consulta")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("pagar")
        .setDescription("Realiza a transferência de cookies para outro usuário")
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Usuário destinatário")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName("quantidade")
            .setDescription("Montante a ser transferido")
            .setRequired(true)
            .setMinValue(1)
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
              `Rendimento total: **${amount(profile.totalEarned)}**`,
              `Despesas e perdas: **${amount(profile.totalSpent)}**`,
              `Resultado em apostas: **${amount(netProfit)}**`,
            ].join("\n"),
            inline: false,
          },
          {
            name: `${emoji.keyboardWumpus} Jogos`,
            value: [
              `Vitórias: **${amount(profile.betWins)}**`,
              `Derrotas: **${amount(profile.betLosses)}**`,
              `Empates: **${amount(profile.draws)}**`,
              `Partidas: **${amount(profile.gamesPlayed)}**`,
            ].join("\n"),
            inline: true,
          },
          {
            name: `${emoji.calendar} Daily`,
            value: [
              `Sequência: **${amount(profile.dailyStreak)}**`,
              `Melhor marca: **${amount(profile.bestDailyStreak)}**`,
              `Resgates: **${amount(profile.dailyClaims)}**`,
            ].join("\n"),
            inline: true,
          },
          {
            name: `${emoji.booster} Taxa de Manutenção Diária`,
            value: "Incidência de 1% ao dia sobre saldos excedentes a **500 cookies**. Limite máximo de **250 cookies** por dia.",
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

    if (subcommand === "pagar") {
      const target = interaction.options.getUser("usuario");
      const quantity = interaction.options.getInteger("quantidade");
      const result = transfer(interaction.user, target, quantity, buildContext(interaction));

      if (!result.ok && result.reason === "self") {
        return interaction.reply({
          embeds: [buildInlineErrorEmbed("Não é possível realizar transferências para a própria conta.")],
          flags: 64,
        });
      }

      if (!result.ok && result.reason === "balance") {
        return interaction.reply({
          embeds: [buildInlineErrorEmbed(`Saldo insuficiente. Você não possui ${cookieEmoji()} **${amount(quantity)} cookies** para esta transferência!`)],
          flags: 64,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`${emoji.greenTick} Transferência Realizada com Sucesso`)
        .setDescription(
          [
            `<@${interaction.user.id}> enviou ${cookieEmoji()} **${amount(result.amount)} cookies** para <@${target.id}>.`,
            "",
            `Seu saldo: ${cookieEmoji()} **${amount(result.from.balance)}**`,
            `Saldo de ${target.username}: ${cookieEmoji()} **${amount(result.to.balance)}**`,
          ].join("\n")
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
