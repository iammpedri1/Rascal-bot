const { SlashCommandBuilder } = require("discord.js");

const cooldowns = require("../utils/cooldowns");
const { buildRemindersEmbed } = require("../utils/cookieViews");

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("lembretes")
    .setDescription("Mostra seus cooldowns de cookies"),

  async execute(interaction) {
    const userCooldowns = cooldowns.allForUser(interaction.user.id);

    return interaction.reply({
      embeds: [buildRemindersEmbed(interaction, interaction.user, userCooldowns)],
      flags: 64,
    });
  },
};
