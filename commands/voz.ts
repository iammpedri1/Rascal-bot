import { defineCommand } from "../types/command";
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");
const emoji = require("../utils/emojis");
const { randomColor } = require("../utils/embedStyle");
const { getVoiceTime, syncActiveVoiceSessions } = require("../utils/voiceStats");

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${hours}h ${minutes}m ${remainder}s`;
}

function buildVoiceEmbed(interaction, totals) {
  const user = interaction.user;
  return new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${emoji.voice} » Tempo de VOZ de ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription([
      `${emoji.calendar} » Hoje: \`${formatDuration(totals.today)}\``,
      `${emoji.trophy} » Esta semana: \`${formatDuration(totals.week)}\``,
      `${emoji.created} » Este mês: \`${formatDuration(totals.month)}\``,
      `${emoji.voice} » Total: \`${formatDuration(totals.total)}\``,
      "",
      "Você mandou bem!",
    ].join("\n"))
    .setFooter({
      text: interaction.client.user?.username || "Rascal",
      iconURL: interaction.client.user?.displayAvatarURL({ size: 64 }) || undefined,
    });
}

module.exports = defineCommand({
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("voz")
    .setDescription("Veja seu tempo em canais de voz hoje, esta semana, este mês e no total"),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use `/voz` dentro de um servidor.", flags: 64 });
    }

    syncActiveVoiceSessions(interaction.guild);
    const totals = getVoiceTime(interaction.guildId, interaction.user.id);
    return interaction.reply({ embeds: [buildVoiceEmbed(interaction, totals)] });
  },
});
