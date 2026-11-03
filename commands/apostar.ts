import { ButtonStyle, SlashCommandBuilder } from "discord.js";
import { defineCommand } from "../types/command";
import type { CommandChatInputInteraction } from "../types/command";
import type { Logger } from "../types/logger";
import { activeGames } from "../utils/activeGames";
import { refundGameBets, reserveStakes, resolveGame } from "../utils/gameEconomy";
import { betAgainstHouseOutcome, betAgainstHousePayout, HOUSE_PAYOUT_MULTIPLIER, HOUSE_WIN_CHANCE_PERCENT } from "../utils/gameRules";
import { buttonRow, contextFor, formatCookies, gameButton, gameEmbed, icon, LOSS_COLOR, WIN_COLOR } from "../utils/gameUi";

const { randomUUID, randomInt } = require("node:crypto") as typeof import("node:crypto");
const { setTimeout: delay } = require("node:timers/promises") as typeof import("node:timers/promises");
const logger = require("../utils/logger") as Logger;
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
      content: `${icon("crossed", "❌")} Você já está em outro minijogo. Termine ou aguarde a partida atual.`,
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
        ? `Saldo insuficiente: você tem **${formatCookies(reservation.balance ?? 0)}** cookies.`
        : "Não consegui reservar essa aposta. Tente novamente.";
      await interaction.editReply({ embeds: [gameEmbed("Aposta não iniciada", message, LOSS_COLOR)] });
      return;
    }
    stakeReserved = true;

    await interaction.editReply({
      embeds: [gameEmbed(
        `${icon("roulette", "🎰")} A banca está girando...`,
        `${interaction.user} apostou **${formatCookies(amount)} cookies**.\n\n${icon("sparkles", "✨")} Boa sorte!\nChance de vitória: **${HOUSE_WIN_CHANCE_PERCENT}%** · retorno de **${HOUSE_PAYOUT_MULTIPLIER}x** na vitória.`,
      )],
    });

    await delay(1_400);
    const outcome = betAgainstHouseOutcome(randomInt(100));
    const won = outcome === "win";
    const payout = betAgainstHousePayout(outcome, amount);
    const result = resolveGame(gameId, [{
      userId,
      username: interaction.user.username,
      outcome: won ? "win" : "loss",
      payout,
      note: "/apostar contra a banca",
    }], context)[0];
    settled = true;

    const resultEmbed = gameEmbed(
      won ? `${WON_EMOJI} VITÓRIA CONTRA A BANCA` : `${LOST_EMOJI} DERROTA CONTRA A BANCA`,
      won
        ? `${interaction.user} acertou o resultado e dobrou a aposta.\n\n${WON_EMOJI} **Lucro líquido:** +${formatCookies(amount)} cookies.`
        : `${interaction.user} não levou esta rodada. A aposta foi debitada da carteira.\n\n${LOST_EMOJI} **Perda:** −${formatCookies(amount)} cookies.`,
      won ? WIN_COLOR : LOSS_COLOR,
    )
      .setAuthor({
        name: `Cassino Rascal · ${interaction.user.globalName || interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ size: 128 }),
      })
      .addFields(
        { name: "Aposta", value: `${formatCookies(amount)} cookies`, inline: true },
        { name: won ? "Retorno total" : "Retorno", value: `${formatCookies(payout)} cookies`, inline: true },
        { name: "Saldo atualizado", value: `${formatCookies(result.balance)} cookies`, inline: true },
      )
      .setImage(won ? BET_RESULT_GIFS.win : BET_RESULT_GIFS.loss);

    await interaction.editReply({
      embeds: [resultEmbed],
      components: [buttonRow(gameButton(`apostar|jogar_novamente|${amount}`, "Apostar novamente", "revanche", "🔁", ButtonStyle.Secondary))],
    });
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
        embeds: [gameEmbed("Rodada cancelada", "Não consegui concluir a partida. Se cookies foram reservados, já foram devolvidos.", LOSS_COLOR)],
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
    .setDescription("Aposte cookies contra a banca em uma rodada de cassino")
    .addIntegerOption((option) => option
      .setName("quantidade")
      .setDescription("Quantidade de cookies apostada")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(1_000_000_000)),
  async execute(interaction) {
    await executeBet(interaction);
  },

  async handleButton(interaction) {
    const [command, action, amountRaw] = interaction.customId.split("|");
    if (command !== "apostar" || action !== "jogar_novamente") return;

    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount < 1) {
      return interaction.reply({
        content: "Não consegui apostar novamente.",
        flags: 64,
      });
    }

    const replay = Object.create(interaction);
    replay.options = { getInteger: () => amount };
    return module.exports.execute(replay);
  },
});
