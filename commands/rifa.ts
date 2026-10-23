const { SlashCommandBuilder } = require("discord.js");

const { playRifa } = require("../utils/cookieEconomy");
const {
  amount,
  buildErrorEmbed,
  buildContext,
  buildRifaEmbed,
  COOKIE_EMOJI,
} = require("../utils/cookieViews");

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("rifa")
    .setDescription("Aposte cookies na rifa")
    .addIntegerOption(option =>
      option
        .setName("aposta")
        .setDescription("Quantidade de cookies para apostar")
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const bet = interaction.options.getInteger("aposta");
    const result = playRifa(interaction.user, bet, buildContext(interaction));

    if (!result.ok && result.reason === "balance") {
      return interaction.reply({
        embeds: [buildErrorEmbed(
          interaction,
          "\uD83C\uDF9F\uFE0F RIFA BLOQUEADA",
          `Você não tem ${COOKIE_EMOJI} **${amount(result.amount)} cookies** para apostar.`
        )],
        flags: 64,
      });
    }

    return interaction.reply({ embeds: [buildRifaEmbed(interaction, result)] });
  },
};
