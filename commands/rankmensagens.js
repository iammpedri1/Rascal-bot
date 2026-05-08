const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { getWeeklyMessageLeaderboard } = require("../utils/xpSystem");

const RANK_COLOR = 0xf5a623;
const RANK_LIMIT = 10;

function amount(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function medal(position) {
  if (position === 1) return "\uD83E\uDD47";
  if (position === 2) return "\uD83E\uDD48";
  if (position === 3) return "\uD83E\uDD49";
  return `#${position}`;
}

function shortName(profile) {
  return (profile.username || `usuario-${profile.id}`).slice(0, 18);
}

function buildRankEmbed(interaction, rank) {
  const lines = rank.map(profile => [
    `${medal(profile.position)} \u00bb \`${shortName(profile)}\``,
    `\u2514 ${amount(profile.messages)} msgs`,
  ].join("\n"));

  return new EmbedBuilder()
    .setColor(RANK_COLOR)
    .setTitle("\uD83C\uDFC6 \u00bb Ranking Semanal de Mensagens")
    .setThumbnail(interaction.guild.iconURL({ size: 256, extension: "gif" }) || interaction.guild.iconURL({ size: 256 }))
    .setDescription(
      lines.length
        ? lines.join("\n")
        : `${emoji.peepSad} Ningu\u00e9m enviou mensagens suficientes nesta semana.`
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
    .setName("rankmensagens")
    .setDescription("Mostra o ranking semanal de mensagens do servidor"),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Use esse comando em um servidor.",
        flags: 64,
      });
    }

    const rank = getWeeklyMessageLeaderboard(interaction.guildId, RANK_LIMIT);

    return interaction.reply({
      embeds: [buildRankEmbed(interaction, rank)],
    });
  },
};
