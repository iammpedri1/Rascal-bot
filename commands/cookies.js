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
            .setDescription("Usuario para consultar")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("pagar")
        .setDescription("Envia cookies para outro usuario")
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Usuario que vai receber os cookies")
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

      const embed = new EmbedBuilder()
        .setColor(0xfaa61a)
        .setTitle(`${COOKIE_EMOJI} SALDO GLOBAL ${emoji.party}`)
        .setDescription(
          [
            `${emoji.online} Usuario: <@${user.id}>`,
            `${COOKIE_EMOJI} Saldo: **${amount(profile.balance)} cookies**`,
            "",
            `${emoji.clap} Ganhos totais: ${COOKIE_EMOJI} **${amount(profile.totalEarned)}**`,
            `${emoji.sad} Gastos/perdidos: ${COOKIE_EMOJI} **${amount(profile.totalSpent)}**`,
            `${emoji.work} Lucro em apostas: ${COOKIE_EMOJI} **${amount(getNetProfit(profile))}**`,
            "",
            `Vitorias: **${amount(profile.betWins)}**`,
            `Derrotas: **${amount(profile.betLosses)}**`,
            `Empates: **${amount(profile.draws)}**`,
            `Partidas: **${amount(profile.gamesPlayed)}**`,
            "",
            `Sequencia diaria: **${amount(profile.dailyStreak)}**`,
            `Melhor sequencia: **${amount(profile.bestDailyStreak)}**`,
          ].join("\n")
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === "pagar") {
      const target = interaction.options.getUser("usuario");
      const quantity = interaction.options.getInteger("quantidade");
      const result = transfer(interaction.user, target, quantity, buildContext(interaction));

      if (!result.ok && result.reason === "self") {
        return interaction.reply({
          content: "Voce nao pode enviar cookies para voce mesmo.",
          flags: 64,
        });
      }

      if (!result.ok && result.reason === "balance") {
        return interaction.reply({
          content: `Voce nao tem ${COOKIE_EMOJI} **${amount(quantity)} cookies** para enviar.`,
          flags: 64,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`${emoji.clap} TRANSFERENCIA CONCLUIDA`)
        .setDescription(
          [
            `<@${interaction.user.id}> enviou ${COOKIE_EMOJI} **${amount(result.amount)} cookies** para <@${target.id}>.`,
            "",
            `Seu saldo: ${COOKIE_EMOJI} **${amount(result.from.balance)}**`,
            `Saldo de ${target.username}: ${COOKIE_EMOJI} **${amount(result.to.balance)}**`,
          ].join("\n")
        );

      return interaction.reply({ embeds: [embed] });
    }

    return interaction.reply({
      content: "Subcomando desconhecido.",
      flags: 64,
    });
  },
};
