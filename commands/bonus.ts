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
    .setDescription("Resgate seu b\u00f4nus semanal de cookies"),

  async execute(interaction) {
    const result = claimBonus(interaction.user, buildContext(interaction));
    const embed = result.claimed
      ? buildBonusEmbed(interaction, result)
      : buildBonusCooldownEmbed(interaction, result);

    return interaction.reply({ embeds: [embed] });
  },
};
