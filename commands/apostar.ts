import { SlashCommandBuilder } from "discord.js";
import { defineCommand } from "../types/command";
import type { CommandChatInputInteraction } from "../types/command";
import type { Logger } from "../types/logger";
import { activeGames } from "../utils/activeGames";
import { refundGameBets, reserveStakes, resolveGame } from "../utils/gameEconomy";
import { contextFor, formatCookies, gameEmbed, icon, LOSS_COLOR, WIN_COLOR } from "../utils/gameUi";

const { randomUUID, randomInt } = require("node:crypto") as typeof import("node:crypto");
const { setTimeout: delay } = require("node:timers/promises") as typeof import("node:timers/promises");
const logger = require("../utils/logger") as Logger;
const emoji = require("../utils/emojis");
const WON_EMOJI = "<a:Correct:1501637592817602630>";
const LOST_EMOJI = "<a:Crossed:1501637659305705516>";
// GIFs públicos do Tenor: jackpot (vitória) e perda de dinheiro (derrota).
const BET_RESULT_GIFS = {
  win: "https://media1.tenor.com/m/hv0J_QfWhOYAAAAd/jackpot-casino.gif",
  loss: "https://media1.tenor.com/m/0pgJh8gr5IAAAAAd/down-bad-gambling.gif",
} as const;

async function executeBet(interaction: CommandChatInputInteraction): Promise<void> {
  const amount = interaction.options.getInteger("quantidade", true);
  const userId = interaction.user.id;
  const gameId = randomUUID();
  const context = contextFor(interaction);
  let stakeReserved = false;
  let settled = false;

  if (!activeGames.reserveNew([userId], gameId)) {
    await interaction.reply({
      content: `${icon("crossed", "❌")} Você já possui uma partida em andamento. Por favor, finalize-a antes de iniciar uma nova.`,
      flags: 64,
    });
    return;
  }

  try {
    await interaction.deferReply();
    const reservation = reserveStakes(gameId, [{
      userId,
      username: interaction.user.username,
      amount,
    }], context);

    if (!reservation.ok) {
      const message = reservation.reason === "balance"
        ? `Saldo insuficiente. Seu saldo atual é de **${formatCookies(reservation.balance ?? 0)}** cookies.`
        : "Falha na reserva da aposta. Por favor, tente novamente.";
      await interaction.editReply({ embeds: [gameEmbed("Aposta não iniciada", message, LOSS_COLOR)] });
      return;
    }
    stakeReserved = true;

    await interaction.editReply({
      embeds: [gameEmbed(
        `${icon("roulette", "🎰")} A roleta está em movimento...`,
        `${interaction.user} apostou **${formatCookies(amount)} cookies**.\n\n${icon("sparkles", "✨")} Boa sorte!`,
      )],
    });

    await delay(1_400);
    const won = randomInt(100) < 46;
    const payout = won ? amount * 2 : 0;
    const result = resolveGame(gameId, [{
      userId,
      username: interaction.user.username,
      outcome: won ? "win" : "loss",
      payout,
      note: "/apostar contra a banca",
    }], context)[0];
    settled = true;

    const resultEmbed = gameEmbed(
      won ? `${WON_EMOJI} VITÓRIA NO CASSINO` : `${LOST_EMOJI} DERROTA NO CASSINO`,
      won
        ? `${interaction.user} obteve o resultado esperado e duplicou sua aposta!\n\n${emoji.application("correct", "✅")} **Lucro líquido:** +${formatCookies(amount)} cookies.`
        : `${interaction.user} não obteve sucesso nesta rodada. A sorte poderá sorrir na próxima tentativa.\n\n${emoji.application("crossed", "❌")} **Perda:** −${formatCookies(amount)} cookies.`,
      won ? WIN_COLOR : LOSS_COLOR,
    )
      .setAuthor({
        name: `Cassino Rascal • ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ size: 128 }),
      })
      .addFields(
        { name: `${emoji.application("cookie", "🍪")} Aposta`, value: `\`${formatCookies(amount)}\``, inline: true },
        { name: won ? `${emoji.application("announcement", "📈")} Retorno` : `${emoji.application("announcement", "📉")} Retorno`, value: `\`${formatCookies(payout)}\``, inline: true },
        { name: `${emoji.application("shop", "💰")} Saldo Atual`, value: `\`${formatCookies(result.balance)}\``, inline: true },
      )
      .setImage(won ? BET_RESULT_GIFS.win : BET_RESULT_GIFS.loss)
      .setFooter({ text: "Discord Brasil™ • Cassino Rascal" });

    await interaction.editReply({ embeds: [resultEmbed] });
  } catch (error) {
    logger.error("Erro no minijogo /apostar", error, { userId, gameId });
    if (stakeReserved && !settled) {
      try {
        refundGameBets(gameId, context);
      } catch (refundError) {
        logger.error("Falha ao devolver a aposta de /apostar", refundError, { userId, gameId });
      }
    }
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        embeds: [gameEmbed("Partida Cancelada", "Não foi possível finalizar a rodada. Eventuais cookies reservados foram estornados.", LOSS_COLOR)],
      }).catch(() => undefined);
    }
  } finally {
    activeGames.releaseGame(gameId);
  }
}

module.exports = defineCommand({
  category: "games",
  data: new SlashCommandBuilder()
    .setName("apostar")
    .setDescription("Realize apostas de cookies contra a banca no Cassino Rascal")
    .addIntegerOption((option) => option
      .setName("quantidade")
      .setDescription("Quantidade de cookies para aposta")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(1_000_000_000)),
  async execute(interaction) {
    await executeBet(interaction);
  },
});
