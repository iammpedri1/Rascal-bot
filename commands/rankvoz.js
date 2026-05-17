const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");
const {
  getWeeklyVoiceLeaderboard,
  syncActiveVoiceSessions,
} = require("../utils/voiceStats");

const RANK_COLOR = 0x5865f2;
const RANK_LIMIT = 10;

function medal(position) {
  if (position === 1) return "\uD83E\uDD47";
  if (position === 2) return "\uD83E\uDD48";
  if (position === 3) return "\uD83E\uDD49";
  return `#${position}`;
}

function shortName(profile) {
  return (profile.username || `usuario-${profile.id}`).slice(0, 18);
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}min`;
  return `${seconds}s`;
}

function buildRankEmbed(interaction, rank) {
  const lines = rank.map(profile => [
    `${medal(profile.position)} \u00bb \`${shortName(profile)}\``,
    `\u2514 ${formatDuration(profile.seconds)} em voz`,
  ].join("\n"));

  return new EmbedBuilder()
    .setColor(RANK_COLOR)
    .setTitle("\uD83C\uDFC6 \u00bb Ranking Semanal de Voz")
    .setThumbnail(interaction.guild.iconURL({ size: 256, extension: "gif" }) || interaction.guild.iconURL({ size: 256 }))
    .setDescription(
      lines.length
        ? lines.join("\n")
        : `${emoji.peepSad} Ningu\u00e9m ficou em call suficiente nesta semana.`
    )
    .setFooter({
      text: interaction.client.user?.username || "Bot",
      iconURL: interaction.client.user?.displayAvatarURL({ size: 64 }) || undefined,
    })
    .setTimestamp();
}

function buildRefreshRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rankvoz_refresh")
      .setLabel("Atualizar")
      .setEmoji("\uD83D\uDD04")
      .setStyle(ButtonStyle.Secondary)
  );
}

async function getLiveRank(interaction) {
  syncActiveVoiceSessions(interaction.guild);
  const rank = getWeeklyVoiceLeaderboard(interaction.guildId, RANK_LIMIT);

  await Promise.all(rank.map(async profile => {
    const member = interaction.guild.members.cache.get(profile.id) ||
      await interaction.guild.members.fetch(profile.id).catch(() => null);
    if (member?.user?.username) profile.username = member.user.username;
  }));

  return rank;
}

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("rankvoz")
    .setDescription("Mostra o ranking semanal de tempo em voz do servidor"),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Use esse comando em um servidor.",
        flags: 64,
      });
    }

    const rank = await getLiveRank(interaction);

    await interaction.reply({
      embeds: [buildRankEmbed(interaction, rank)],
      components: [buildRefreshRow()],
    });

    const response = await interaction.fetchReply();

    const refreshMessage = async () => {
      const nextRank = await getLiveRank(interaction);

      return response.edit({
        embeds: [buildRankEmbed(interaction, nextRank)],
        components: [buildRefreshRow()],
      });
    };

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
    });

    collector.on("collect", async buttonInteraction => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({
          content: "Esse ranking pertence a outra pessoa.",
          flags: 64,
        });
      }

      await buttonInteraction.deferUpdate();
      return refreshMessage();
    });

    collector.on("end", () => {
      response.edit({ components: [] }).catch(() => {});
    });
  },
};
