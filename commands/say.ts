import { defineCommand } from "../types/command";
const { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");
const { ACCESS_LEVELS } = require("../utils/permissions");

const cooldowns = new Map();

module.exports = defineCommand({
  category: "staff",
  access: { level: ACCESS_LEVELS.MODERATOR, permission: PermissionFlagsBits.ManageMessages },

  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Envia uma mensagem oficial através do sistema")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option
        .setName("texto")
        .setDescription("Conteúdo da mensagem a ser enviada")
        .setRequired(true)
    ),

  async execute(interaction) {
    const cooldownMs = 5000;
    const now = Date.now();
    const userId = interaction.user.id;

    if (cooldowns.has(userId)) {
      const expiresAt = cooldowns.get(userId) + cooldownMs;

      if (now < expiresAt) {
        const remaining = Math.ceil((expiresAt - now) / 1000);

        return interaction.reply({
          content: `Por favor, aguarde ${remaining}s antes de enviar uma nova mensagem oficial.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    const text = interaction.options.getString("texto");

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await interaction.channel.send(text);

      cooldowns.set(userId, now);
      setTimeout(() => cooldowns.delete(userId), cooldownMs);

      return interaction.deleteReply();
    } catch (error) {
      console.error("Erro no /say:", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({
          content: "Falha ao processar o envio da mensagem oficial.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => { });
      }

      return interaction.reply({
        content: "Falha ao processar o envio da mensagem oficial.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => { });
    }
  },
});
