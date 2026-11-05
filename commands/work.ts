import { defineCommand } from "../types/command";
import { sendViaWebhook } from "../core/InteractionResponseFormatter";
import { MessageFlags } from "discord.js";

const { SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");

const { work } = require("../utils/cookieEconomy");
const { buildButtons } = require("../utils/cooldownNotifications");
const {
  buildContext,
  buildWorkCooldownEmbed,
  buildWorkEmbed,
  pick,
  workFailReasons,
} = require("../utils/cookieViews");

function isDeadInteractionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const value = error as {
    code?: unknown;
    rawError?: { code?: unknown };
  };

  return [value.code, value.rawError?.code].some((code) =>
    [10062, 40060, 10015].includes(Number(code))
  );
}

module.exports = defineCommand({
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("trabalhar")
    .setDescription("Realize suas atividades profissionais para receber cookies a cada 3 horas"),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      // work() é síncrono e transacional; não precisa de await.
      const result = work(interaction.user, {
        ...buildContext(interaction),
        reason: pick(workFailReasons),
      });

      const embed = result.worked
        ? buildWorkEmbed(interaction, result)
        : buildWorkCooldownEmbed(interaction, result);

      const payload = {
        embeds: [embed],
        components: buildButtons(
          interaction.user.id,
          {},
          { trabalhar: result.nextAt },
          ["trabalhar"],
          interaction.guild
        ),
      };

      // Mantém o webhook já utilizado pelo projeto nas respostas de trabalho.
      // Mantém o helper de webhook já integrado ao projeto.
      if (result.worked) {
        return await sendViaWebhook(interaction, payload);
      }

      return await interaction.editReply(payload);
    } catch (error) {
      if (isDeadInteractionError(error)) return undefined;

      console.error("[trabalhar] Falha ao processar comando:", error);

      const fallback = {
        content: "Não foi possível concluir seu turno agora.",
        embeds: [],
        components: [],
      };

      try {
        if (interaction.deferred || interaction.replied) {
          return await interaction.editReply(fallback);
        }

        return await interaction.reply({
          ...fallback,
          flags: MessageFlags.Ephemeral,
        });
      } catch (responseError) {
        if (!isDeadInteractionError(responseError)) {
          console.error("[trabalhar] Falha ao responder à interação:", responseError);
        }
        return undefined;
      }
    }
  },
});