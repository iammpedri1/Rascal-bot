import { defineCommand } from "../types/command";
import { sendViaWebhook } from "../core/InteractionResponseFormatter";
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
    .setDescription("Realize suas atividades profissionais para receber cookies a cada 3 horas"),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const result = work(interaction.user, {
        ...buildContext(interaction),
        reason: pick(workFailReasons),
        job: pick(workSuccessMessages),
      });
      const embed = result.worked
        ? buildWorkEmbed(interaction, result)
        : buildWorkCooldownEmbed(interaction, result);

      const payload = {
        embeds: [embed],
        components: buildButtons(interaction.user.id, {}, { trabalhar: result.nextAt }, ["trabalhar"], interaction.guild),
      };

      return result.worked
        ? sendViaWebhook(interaction, payload)
        : interaction.editReply(payload);
    } catch (error) {
      console.error("[trabalhar] falha ao processar comando:", error);
      if (interaction.deferred && !interaction.replied) {
        return interaction.editReply("Não foi possível concluir seu turno agora.");
      }
      return undefined;
    }
  },
});
