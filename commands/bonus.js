const { SlashCommandBuilder } = require("discord.js");

const { claimBonus } = require("../utils/cookieEconomy");
const {
  buildBonusCooldownEmbed,
  buildBonusEmbed,
  buildContext,
} = require("../utils/cookieViews");

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("bonus")
    .setDescription("Colete um bonus de cookies a cada 6 horas"),

  async execute(interaction) {
    const result = claimBonus(interaction.user, buildContext(interaction));
    const embed = result.claimed
      ? buildBonusEmbed(interaction, result)
      : buildBonusCooldownEmbed(interaction, result);

    return interaction.reply({ embeds: [embed] });
  },
};
