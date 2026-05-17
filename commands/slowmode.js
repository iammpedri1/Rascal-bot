const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

module.exports = {
  category: "staff",

  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Define o modo lento do canal atual")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(option =>
      option
        .setName("segundos")
        .setDescription("Tempo do modo lento em segundos, use 0 para desativar")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    )
    .addStringOption(option =>
      option
        .setName("motivo")
        .setDescription("Motivo do modo lento")
        .setRequired(false)
        .setMaxLength(300)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use esse comando em um servidor.", flags: 64 });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: "Apenas a staff pode alterar o modo lento.", flags: 64 });
    }

    const seconds = interaction.options.getInteger("segundos", true);
    const reason = interaction.options.getString("motivo") || "Não informado";

    await interaction.channel.setRateLimitPerUser(seconds, `Slowmode por ${interaction.user.tag}: ${reason}`);

    const embed = new EmbedBuilder()
      .setColor(seconds > 0 ? 0x58b9ff : 0x57f287)
      .setTitle(seconds > 0 ? `🐢 Slowmode ativado: ${seconds}s` : "🐢 Slowmode desativado")
      .setDescription(
        [
          `**Motivo:** ${reason}`,
          `**Staff:** ${interaction.user}`,
        ].join("\n")
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
