import { defineCommand } from "../types/command";
const { SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");

const { claimBonus } = require("../utils/cookieEconomy");
const {
  buildBonusCooldownEmbed,
  buildBonusEmbed,
  buildContext,
} = require("../utils/cookieViews");

module.exports = defineCommand({
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("bonus")
    .setDescription("Resgate sua bonificação semanal de cookies"),

  async execute(interaction) {
    const result = claimBonus(interaction.user, buildContext(interaction));
    const embed = result.claimed
      ? buildBonusEmbed(interaction, result)
      : buildBonusCooldownEmbed(interaction, result);

    return interaction.reply({ embeds: [embed] });
  },
});
