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
    .setDescription("Colete sua recompensa diaria de cookies a cada 24 horas"),

  async execute(interaction) {
    const result = claimDaily(interaction.user, buildContext(interaction));
    const embed = result.claimed
      ? buildDailyEmbed(interaction, result)
      : buildDailyCooldownEmbed(interaction, result);

    return interaction.reply({ embeds: [embed] });
  },
};
