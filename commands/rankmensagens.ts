import { defineCommand } from "../types/command";
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");

const emoji = require("../utils/emojis");
const { getLifetimeMessageLeaderboard } = require("../utils/messageStats");

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
    `\u2514 ${amount(profile.messages)} mensagens`,
  ].join("\n"));

  return new EmbedBuilder()
    .setColor(RANK_COLOR)
    .setTitle("\uD83C\uDFC6 \u00bb Classificação Histórica de Mensagens")
    .setThumbnail(interaction.guild.iconURL({ size: 256, extension: "gif" }) || interaction.guild.iconURL({ size: 256 }))
    .setDescription(
      lines.length
        ? lines.join("\n")
        : `${emoji.peepSad} Não há dados suficientes para gerar a classificação no momento.`
    )
    .setFooter({
      text: "Histórico consolidado de interações no servidor",
      iconURL: interaction.client.user?.displayAvatarURL({ size: 64 }) || undefined,
    })
    .setTimestamp();
}

function buildRefreshRow(): import("discord.js").ActionRowBuilder<import("discord.js").ButtonBuilder> {
  return new ActionRowBuilder<import("discord.js").ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("rankmensagens_refresh")
      .setLabel("Atualizar")
      .setEmoji(emoji.toComponentEmoji("\uD83D\uDD04"))
      .setStyle(ButtonStyle.Secondary)
  );
}

async function getLiveRank(interaction) {
  const rank = getLifetimeMessageLeaderboard(RANK_LIMIT);

  await Promise.all(rank.map(async profile => {
    const member = interaction.guild.members.cache.get(profile.id) ||
      await interaction.guild.members.fetch(profile.id).catch(() => null);
    if (member?.user?.username) profile.username = member.user.username;
  }));

  return rank;
}

module.exports = defineCommand({
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("rankmensagens")
    .setDescription("Exibe a classificação histórica de mensagens enviadas no servidor"),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Este comando está disponível apenas em servidores.",
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
          content: "Esta interação é exclusiva para o autor do comando.",
          flags: 64,
        });
      }

      await buttonInteraction.deferUpdate();
      return refreshMessage();
    });

    collector.on("end", () => {
      response.edit({ components: [] }).catch(() => { });
    });
  },
});
