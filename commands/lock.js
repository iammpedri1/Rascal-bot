const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");

module.exports = {
  category: "staff",

  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Trava o canal atual para membros comuns")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(option =>
      option
        .setName("motivo")
        .setDescription("Motivo do bloqueio")
        .setRequired(false)
        .setMaxLength(300)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use esse comando em um servidor.", flags: 64 });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: "Apenas a staff pode travar canais.", flags: 64 });
    }

    const reason = interaction.options.getString("motivo") || "Não informado";

    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: false,
      AddReactions: false,
    }, { reason: `Canal bloqueado por ${interaction.user.tag}: ${reason}` });

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("🔒 Canal bloqueado")
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
