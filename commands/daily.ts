import { defineCommand } from "../types/command";
const { SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");

const { claimDaily } = require("../utils/cookieEconomy");
const { buildButtons } = require("../utils/cooldownNotifications");
const {
  buildContext,
  buildDailyCooldownEmbed,
  buildDailyEmbed,
} = require("../utils/cookieViews");

module.exports = defineCommand({
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Resgate sua recompensa diária de cookies a cada 24 horas"),

  async execute(interaction) {
    await interaction.deferReply();
    const result = claimDaily(interaction.user, buildContext(interaction));
    const embed = result.claimed
      ? buildDailyEmbed(interaction, result)
      : buildDailyCooldownEmbed(interaction, result);

    return interaction.editReply({
      embeds: [embed],
      components: buildButtons(interaction.user.id, {}, { daily: result.nextAt }, ["daily"], interaction.guild),
    });
  },
});
