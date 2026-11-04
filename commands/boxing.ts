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
      .setLabel("Aceitar Combate")
      .setEmoji(emoji.toComponentEmoji("\u{1F94A}"))
      .setStyle(ButtonStyle.Danger)
  );
}

module.exports = defineCommand({
  category: "games",

  data: new SlashCommandBuilder()
    .setName("boxe")
    .setDescription("Desafie um membro para um combate de boxe")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário que deseja desafiar")
        .setRequired(true)
    ),

  async execute(interaction) {
    const opponent = interaction.options.getUser("usuario");

    if (opponent.id === interaction.user.id) {
      return interaction.reply({
        content: `${boxingEmoji()} Não é possível desafiar a si próprio.`,
        flags: 64,
      });
    }

    if (opponent.bot) {
      return interaction.reply({
        content: `${boxingEmoji()} Entidades robóticas não estão autorizadas a participar deste combate.`,
        flags: 64,
      });
    }

    const challengeId = createChallengeId();
    pendingChallenges.set(challengeId, {
      challengerId: interaction.user.id,
      opponentId: opponent.id,
    });

    const timeout = setTimeout(() => {
      pendingChallenges.delete(challengeId);
    }, CHALLENGE_TIMEOUT);
    timeout.unref?.();

    const embed = new EmbedBuilder()
      .setColor(0xE53935)
      .setTitle(`${boxingEmoji()} Desafio de Boxe`)
      .setDescription(
        `${interaction.user} desafiou ${opponent} para uma luta!\n` +
        `A chance de vitória é de **50% para cada lado**.\n\n` +
        `${opponent}, você tem 60 segundos para aceitar.`
      );

    return interaction.reply({
      embeds: [embed],
      components: [challengeRow(challengeId)],
    });
  },

  async handleButton(interaction) {
    if (!interaction.customId.startsWith("boxing|accept|")) return;

    const challengeId = interaction.customId.split("|")[2];
    const challenge = pendingChallenges.get(challengeId);

    if (!challenge) {
      return interaction.reply({
        content: `${boxingEmoji()} Este desafio expirou.`,
        flags: 64,
      });
    }

    if (interaction.user.id !== challenge.opponentId) {
      return interaction.reply({
        content: `${boxingEmoji()} Apenas o usuário desafiado tem permissão para aceitar o combate.`,
        flags: 64,
      });
    }

    pendingChallenges.delete(challengeId);

    const challengerWins = Math.random() < 0.5;
    const winnerId = challengerWins
      ? challenge.challengerId
      : challenge.opponentId;
    const loserId = challengerWins
      ? challenge.opponentId
      : challenge.challengerId;

    await interaction.deferUpdate();
    const gif = await getAnimeGif("win");

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(`${boxingEmoji()} Resultado do Combate`)
      .setDescription(
        `${boxingEmoji()} <@${challenge.challengerId}> e <@${challenge.opponentId}> lutaram!\n\n` +
        `🏆 <@${winnerId}> consagrou-se vencedor!\n` +
        `💥 <@${loserId}> foi superado no combate.`
      );

    embed.setImage(gif);

    return interaction.editReply({ embeds: [embed], components: [] });
  },
});
