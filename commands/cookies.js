const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");
const {
  getNetProfit,
  getProfile,
  transfer,
} = require("../utils/cookieEconomy");
const {
  buildInlineErrorEmbed,
} = require("../utils/cookieViews");

const COOKIE_EMOJI = emoji.cookie;

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

module.exports = {
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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("pagar")
        .setDescription("Envia cookies para outro usuário")
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Usuário que vai receber os cookies")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName("quantidade")
            .setDescription("Quantidade de cookies para enviar")
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
        .setTitle(`${COOKIE_EMOJI} Saldo de Cookies`)
        .setThumbnail(emojiImageUrl(emoji.cookie) || user.displayAvatarURL({ size: 256 }))
        .setDescription(
          [
            `${emoji.online} \u00bb Usuário: <@${user.id}>`,
            `${COOKIE_EMOJI} \u00bb Saldo atual: **${amount(profile.balance)} cookies**`,
          ].join("\n")
        )
        .addFields(
          {
            name: `${emoji.clap} Movimentacao`,
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
            name: `${emoji.gift} Daily`,
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

    if (subcommand === "pagar") {
      const target = interaction.options.getUser("usuario");
      const quantity = interaction.options.getInteger("quantidade");
      const result = transfer(interaction.user, target, quantity, buildContext(interaction));

      if (!result.ok && result.reason === "self") {
        return interaction.reply({
          embeds: [buildInlineErrorEmbed("Você não pode enviar cookies para você mesmo!")],
          flags: 64,
        });
      }

      if (!result.ok && result.reason === "balance") {
        return interaction.reply({
          embeds: [buildInlineErrorEmbed(`Você não tem ${COOKIE_EMOJI} **${amount(quantity)} cookies** para enviar!`)],
          flags: 64,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`${emoji.greenTick} Transferencia concluida`)
        .setDescription(
          [
            `<@${interaction.user.id}> enviou ${COOKIE_EMOJI} **${amount(result.amount)} cookies** para <@${target.id}>.`,
            "",
            `Seu saldo: ${COOKIE_EMOJI} **${amount(result.from.balance)}**`,
            `Saldo de ${target.username}: ${COOKIE_EMOJI} **${amount(result.to.balance)}**`,
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
};
