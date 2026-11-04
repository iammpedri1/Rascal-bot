import { defineCommand } from "../types/command";
const { SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");

const { playRifa } = require("../utils/cookieEconomy");
const emoji = require("../utils/emojis");
const {
  amount,
  buildErrorEmbed,
  buildContext,
  buildRifaEmbed,
} = require("../utils/cookieViews");

module.exports = defineCommand({
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("rifa")
    .setDescription("Participe da rifa instantânea utilizando seus cookies")
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
          "\uD83C\uDF9F\uFE0F OPERAÇÃO CANCELADA",
          `Saldo insuficiente para realizar esta aposta de ${emoji.cookie} **${amount(result.amount)} cookies**.`
        )],
        flags: 64,
      });
    }

    return interaction.reply({ embeds: [buildRifaEmbed(interaction, result)] });
  },
});
