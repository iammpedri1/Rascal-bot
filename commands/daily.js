const { SlashCommandBuilder } = require("discord.js");

const { claimDaily } = require("../utils/cookieEconomy");
const {
  buildContext,
  buildDailyCooldownEmbed,
  buildDailyEmbed,
} = require("../utils/cookieViews");

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Colete sua recompensa de cookies a cada 12 horas"),

  async execute(interaction) {
    const result = claimDaily(interaction.user, buildContext(interaction));
    const embed = result.claimed
      ? buildDailyEmbed(interaction.user, result)
      : buildDailyCooldownEmbed(interaction.user, result);

    return interaction.reply({ embeds: [embed] });
  },
};
