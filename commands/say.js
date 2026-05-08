const { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

const cooldowns = new Map();

module.exports = {
  category: "staff",

  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Faz o bot enviar uma mensagem no canal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option
        .setName("texto")
        .setDescription("Mensagem que o bot vai enviar")
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
          content: `Aguarde ${remaining}s para usar o /say novamente.`,
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
          content: "Erro ao enviar mensagem.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }

      return interaction.reply({
        content: "Erro ao enviar mensagem.",
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    }
  },
};
