import { defineCommand } from "../types/command";
const { SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");

const { work } = require("../utils/cookieEconomy");
const { buildButtons } = require("../utils/cooldownNotifications");
const {
  buildContext,
  buildWorkCooldownEmbed,
  buildWorkEmbed,
  pick,
  workFailReasons,
  workSuccessMessages,
} = require("../utils/cookieViews");

module.exports = defineCommand({
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("trabalhar")
    .setDescription("Trabalhe na firma e tente ganhar cookies a cada 3 horas"),

  async execute(interaction) {
    await interaction.deferReply();
    const result = work(interaction.user, {
      ...buildContext(interaction),
      reason: pick(workFailReasons),
      job: pick(workSuccessMessages),
    });
    const embed = result.worked
      ? buildWorkEmbed(interaction, result)
      : buildWorkCooldownEmbed(interaction, result);

    return interaction.editReply({
      embeds: [embed],
      components: buildButtons(interaction.user.id, {}, { trabalhar: result.nextAt }, ["trabalhar"], interaction.guild),
    });
  },
});
