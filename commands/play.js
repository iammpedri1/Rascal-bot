const {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");
const { playLofi, stopLofi } = require("../utils/lofiPlayer");

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Toca rádio no canal de voz")
    .addSubcommand(subcommand =>
      subcommand
        .setName("lofi")
        .setDescription("Toca uma rádio lo-fi/chillhop 24 horas")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("parar")
        .setDescription("Para a rádio e desconecta o bot da call")
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: `${emoji.crossed} Use esse comando em um servidor.`,
        flags: 64,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "parar") {
      const stopped = stopLofi(interaction.guildId);

      return interaction.reply({
        content: stopped
          ? `${emoji.correct} Rádio lo-fi parada.`
          : `${emoji.peepSad} Não estou tocando rádio neste servidor.`,
        flags: 64,
      });
    }

    const member = interaction.member;
    const channel = member?.voice?.channel;

    if (!channel) {
      return interaction.reply({
        content: `${emoji.voice} Entre em um canal de voz antes de usar \`/play lofi\`.`,
        flags: 64,
      });
    }

    const permissions = channel.permissionsFor(interaction.client.user);
    if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions?.has(PermissionFlagsBits.Speak)) {
      return interaction.reply({
        content: `${emoji.crossed} Preciso das permissões **Conectar** e **Falar** nesse canal de voz.`,
        flags: 64,
      });
    }

    await interaction.deferReply();

    try {
      const session = await playLofi(channel);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`${emoji.pandaCientista} Rádio lo-fi ligada`)
        .setDescription(
          [
            `${emoji.voice} Tocando em ${channel}.`,
            `${emoji.sino} Use \`/play parar\` para desconectar.`,
          ].join("\n")
        )
        .setFooter({ text: new URL(session.streamUrl).hostname })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      stopLofi(interaction.guildId);

      return interaction.editReply({
        content: `${emoji.crossed} Não consegui entrar ou tocar a rádio agora. Confira minhas permissões e tente novamente.`,
      });
    }
  },
};
