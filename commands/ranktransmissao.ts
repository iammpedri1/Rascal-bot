import { defineCommand } from "../types/command";
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");

const emoji = require("../utils/emojis") as typeof import("../utils/emojis");
const logger = require("../utils/logger");
const { randomColor } = require("../utils/embedStyle");
const {
  getLifetimeTransmissionLeaderboard,
  syncActiveVoiceSessions,
} = require("../utils/voiceStats");

const PAGE_SIZE = 10;
const RANK_LIMIT = 500;
const WEEKLY_PRIZES = [15000, 10000, 5000];

function isDeadInteractionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const value = error as { code?: number; rawError?: { code?: number } };
  return [10062, 40060, 10015].includes(value.code ?? value.rawError?.code ?? -1);
}

function medal(position: number): string {
  return `#${position}`;
}

function amount(value: number): string {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("pt-BR");
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function buildRankEmbed(interaction, rank, page: number) {
  const maxPage = Math.max(1, Math.ceil(rank.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const visible = rank.slice(start, start + PAGE_SIZE);
  const from = rank.length ? start + 1 : 0;
  const to = start + visible.length;
  const arrow = emoji.getGuildEmoji(interaction.guild, "next", "");
  const lines = visible.map((profile, index) => [
    `> ${medal(start + index + 1)} » **${profile.username}**`,
    `> ${arrow ? `${arrow} ` : ""}**${formatDuration(profile.seconds)}** em transmissão`,
  ].join("\n"));
  const trophy = emoji.getGuildEmoji(interaction.guild, "trophy", "");

  return new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${emoji.getGuildEmoji(interaction.guild, "streaming", "")} » CLASSIFICAÇÃO HISTÓRICA DE TRANSMISSÃO ${from}-${to}`)
    .setThumbnail(interaction.guild.iconURL({ size: 256, extension: "gif" }) || interaction.guild.iconURL({ size: 256 }))
    .setDescription([
      lines.length ? lines.join("\n\n") : `${emoji.getEmoji("peepSad", "")} Não há registros de transmissão suficientes para gerar a classificação.`,
      "",
      "💞 Agradecemos a todos que compartilham conteúdo com a comunidade!",
    ].join("\n"))
    .setFooter({ text: `Página ${page + 1} de ${maxPage} · Histórico consolidado` })
    .setTimestamp();
}

function buildButtons(
  interaction,
  page: number,
  maxPage: number,
): import("discord.js").ActionRowBuilder<import("discord.js").ButtonBuilder> {
  return new ActionRowBuilder<import("discord.js").ButtonBuilder>().addComponents(
    emoji.setGuildButtonEmoji(new ButtonBuilder()
      .setCustomId("ranktransmissao|previous")
      .setLabel("Anterior")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0), interaction.guild, "previous", ""),
    emoji.setGuildButtonEmoji(new ButtonBuilder()
      .setCustomId("ranktransmissao|refresh")
      .setLabel("Atualizar")
      .setStyle(ButtonStyle.Primary), interaction.guild, "refresh", ""),
    emoji.setGuildButtonEmoji(new ButtonBuilder()
      .setCustomId("ranktransmissao|next")
      .setLabel("Próxima")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= maxPage - 1), interaction.guild, "next", ""),
  );
}

async function getLiveRank(interaction) {
  syncActiveVoiceSessions(interaction.guild);
  return getLifetimeTransmissionLeaderboard(RANK_LIMIT);
}

async function resolvePageNames(interaction, rank, page: number) {
  const visible = rank.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  await Promise.all(visible.map(async profile => {
    const member = interaction.guild.members.cache.get(profile.id) ||
      await interaction.guild.members.fetch(profile.id).catch(() => null);
    if (member?.user?.username) profile.username = member.user.username;
  }));
}

module.exports = defineCommand({
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("ranktransmissao")
    .setDescription("Exibe a classificação histórica de tempo em transmissão (Streaming)"),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Este comando está disponível apenas em servidores.", flags: 64 });
    }

    await interaction.deferReply();
    let page = 0;
    const rank = await getLiveRank(interaction);
    await resolvePageNames(interaction, rank, page);
    const response = await interaction.editReply({
      embeds: [buildRankEmbed(interaction, rank, page)],
      components: [buildButtons(interaction, page, Math.max(1, Math.ceil(rank.length / PAGE_SIZE)))],
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 10 * 60 * 1000,
    });

    collector.on("collect", async buttonInteraction => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({ content: "Esta interação é exclusiva para o autor do comando.", flags: 64 });
      }

      try {
        await buttonInteraction.deferUpdate();
        const nextRank = await getLiveRank(interaction);
        const maxPage = Math.max(1, Math.ceil(nextRank.length / PAGE_SIZE));
        if (buttonInteraction.customId.endsWith("|previous")) page = Math.max(0, page - 1);
        if (buttonInteraction.customId.endsWith("|next")) page = Math.min(maxPage - 1, page + 1);
        await resolvePageNames(interaction, nextRank, page);
        await response.edit({
          embeds: [buildRankEmbed(interaction, nextRank, page)],
          components: [buildButtons(interaction, page, maxPage)],
        });
      } catch (error) {
        if (!isDeadInteractionError(error)) {
          logger.error("Falha ao atualizar /ranktransmissao", error);
          await buttonInteraction.followUp({
            content: "Não foi possível atualizar a classificação no momento.",
            flags: 64,
          }).catch((replyError) => {
            if (!isDeadInteractionError(replyError)) logger.error("Falha ao informar erro de paginação", replyError);
          });
        }
      }
    });

    collector.on("end", () => {
      response.edit({ components: [] }).catch(() => { });
    });
  },
});
