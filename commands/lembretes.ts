import { defineCommand } from "../types/command";
const { SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");

const cooldowns = require("../utils/cooldowns");
const { buildRemindersEmbed } = require("../utils/cookieViews");
const { buildButtons } = require("../utils/cooldownNotifications");

module.exports = defineCommand({
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("lembretes")
    .setDescription("Visualize o tempo de espera para suas atividades de economia"),

  async execute(interaction) {
    const userCooldowns = cooldowns.allForUser(interaction.user.id);

    return interaction.reply({
      embeds: [buildRemindersEmbed(interaction, interaction.user, userCooldowns)],
      components: buildButtons(interaction.user.id, {}, {
        daily: userCooldowns.daily.expiresAt,
        trabalhar: userCooldowns.work.expiresAt,
      }, undefined, interaction.guild),
      flags: 64,
    });
  },
});
