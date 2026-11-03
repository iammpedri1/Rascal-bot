import { defineCommand } from "../types/command";
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js") as typeof import("discord.js");

const emoji = require("../utils/emojis");
const { getAnimeGif } = require("../utils/animeGifs");
const { activeGames } = require("../utils/activeGames");
const { simulateBoxingMatch } = require("../utils/gameRules");

const CHALLENGE_TIMEOUT = 60_000;
const pendingChallenges = new Map();

function boxingEmoji() {
  return emoji.application("peep_boxing", "\u{1F94A}");
}

function createChallengeId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function challengeRow(challengeId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`boxing|accept|${challengeId}`)
      .setLabel("Aceitar luta")
      .setEmoji(emoji.toComponentEmoji("\u{1F94A}"))
      .setStyle(ButtonStyle.Danger)
  );
}

module.exports = defineCommand({
  category: "games",

  data: new SlashCommandBuilder()
    .setName("boxe")
    .setDescription("Desafie alguém para uma luta de boxe")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Quem você quer desafiar")
        .setRequired(true)
    ),

  async execute(interaction) {
    const opponent = interaction.options.getUser("usuario");

    if (opponent.id === interaction.user.id) {
      return interaction.reply({
        content: `${boxingEmoji()} Você não pode desafiar a si mesmo.`,
        flags: 64,
      });
    }

    if (opponent.bot) {
      return interaction.reply({
        content: `${boxingEmoji()} Bots não podem participar dessa luta.`,
        flags: 64,
      });
    }

    const challengeId = createChallengeId();

    if (!activeGames.reserveNew([interaction.user.id, opponent.id], challengeId)) {
      return interaction.reply({
        content: `${boxingEmoji()} Um dos jogadores já está em outro minijogo.`,
        flags: 64,
      });
    }

    const timeout = setTimeout(() => {
      pendingChallenges.delete(challengeId);
      activeGames.releaseGame(challengeId);
      message.edit({
        content: `${boxingEmoji()} O desafio expirou.`,
        embeds: [],
        components: [],
      }).catch(() => {});
    }, CHALLENGE_TIMEOUT);
    timeout.unref?.();

    const embed = new EmbedBuilder()
      .setColor(0xE53935)
      .setTitle(`${boxingEmoji()} Desafio de boxe`)
      .setDescription(
        `${interaction.user} desafiou ${opponent} para uma luta!\n` +
        `A luta terá 3 rounds; cada round tem 50% de chance para cada lado.\n\n` +
        `${opponent}, você tem 60 segundos para aceitar.`
      );

    await interaction.reply({
      embeds: [embed],
      components: [challengeRow(challengeId)],
    });
    const message = await interaction.fetchReply();

    pendingChallenges.set(challengeId, {
      challengerId: interaction.user.id,
      opponentId: opponent.id,
      message,
      timeout,
    });
  },

  async handleButton(interaction) {
    if (!interaction.customId.startsWith("boxing|accept|")) return;

    const challengeId = interaction.customId.split("|")[2];
    const challenge = pendingChallenges.get(challengeId);

    if (!challenge) {
      return interaction.reply({
        content: `${boxingEmoji()} Esse desafio expirou.`,
        flags: 64,
      });
    }

    if (interaction.user.id !== challenge.opponentId) {
      return interaction.reply({
        content: `${boxingEmoji()} Só o usuário desafiado pode aceitar essa luta.`,
        flags: 64,
      });
    }

    if (challenge.timeout) clearTimeout(challenge.timeout);
    activeGames.releaseGame(challengeId);
    pendingChallenges.delete(challengeId);

    const match = simulateBoxingMatch(3);
    const winnerId = match.winner === "challenger"
      ? challenge.challengerId
      : challenge.opponentId;
    const loserId = match.winner === "challenger"
      ? challenge.opponentId
      : challenge.challengerId;

    await interaction.deferUpdate();
    const gif = await getAnimeGif("win");

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(`${boxingEmoji()} Resultado da luta`)
      .setDescription(
        `${boxingEmoji()} <@${challenge.challengerId}> e <@${challenge.opponentId}> lutaram!\n\n` +
        match.rounds.map(round => `Round ${round.round}: ${round.winner === "challenger" ? `**<@${challenge.challengerId}>**` : `**<@${challenge.opponentId}>**`} venceu`).join("\n") +
        `\n\n🏆 <@${winnerId}> venceu por ${match.challengerRounds} a ${match.opponentRounds}!\n` +
        `💥 <@${loserId}> perdeu por pouco.`
      );

    embed.setImage(gif);

    return interaction.editReply({ embeds: [embed], components: [] });
  },
});
