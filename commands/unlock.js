const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

module.exports = {
  category: "staff",

  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Destrava o canal atual")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(option =>
      option
        .setName("motivo")
        .setDescription("Motivo do desbloqueio")
        .setRequired(false)
        .setMaxLength(300)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use esse comando em um servidor.", flags: 64 });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: "Apenas a staff pode destravar canais.", flags: 64 });
    }

    const reason = interaction.options.getString("motivo") || "Não informado";

    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: null,
      AddReactions: null,
    }, { reason: `Canal desbloqueado por ${interaction.user.tag}: ${reason}` });

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("🔓 Canal desbloqueado")
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
