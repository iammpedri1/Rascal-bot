const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { getWeeklyVoiceLeaderboard } = require("../utils/voiceStats");

const RANK_COLOR = 0x9b8cff;
const RANK_LIMIT = 10;

function medal(position) {
  if (position === 1) return "\uD83E\uDD47";
  if (position === 2) return "\uD83E\uDD48";
  if (position === 3) return "\uD83E\uDD49";
  return `#${position}`;
}

function shortName(profile) {
  return (profile.username || `usuario-${profile.id}`).slice(0, 22);
}

function formatVoiceTime(seconds) {
  const totalMinutes = Math.max(1, Math.floor(Number(seconds || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m de voz`;
  return `${minutes}m de voz`;
}

function buildRankEmbed(interaction, rank) {
  const lines = rank.map(profile => [
    `${medal(profile.position)} \u00bb \`${shortName(profile)}\``,
    `\u2514 ${formatVoiceTime(profile.seconds)}`,
  ].join("\n"));

  return new EmbedBuilder()
    .setColor(RANK_COLOR)
    .setTitle("\uD83D\uDD0A \u00bb Ranking Semanal de Voz")
    .setThumbnail(interaction.guild.iconURL({ size: 256, extension: "gif" }) || interaction.guild.iconURL({ size: 256 }))
    .setDescription(
      lines.length
        ? lines.join("\n")
        : `${emoji.peepSad} Ningu\u00e9m passou tempo em voz nesta semana.`
    )
    .setFooter({
      text: interaction.client.user?.username || "Bot",
      iconURL: interaction.client.user?.displayAvatarURL({ size: 64 }) || undefined,
    })
    .setTimestamp();
}

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("rankvoz")
    .setDescription("Mostra o ranking semanal de tempo em canais de voz"),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Use esse comando em um servidor.",
        flags: 64,
      });
    }

    const rank = getWeeklyVoiceLeaderboard(interaction.guildId, RANK_LIMIT);

    return interaction.reply({
      embeds: [buildRankEmbed(interaction, rank)],
    });
  },
};
