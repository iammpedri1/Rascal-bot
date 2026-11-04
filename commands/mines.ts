import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
  type ButtonInteraction,
  type Message,
} from "discord.js";
import { defineCommand } from "../types/command";
import type { CommandChatInputInteraction } from "../types/command";
import { activeGames } from "../utils/activeGames";
import { refundGameBets, reserveStakes, resolveGame } from "../utils/gameEconomy";
import {
  buttonRow,
  contextFor,
  formatCookies,
  gameButton,
  IDLE_TIMEOUT_MS,
  LOSS_COLOR,
  WIN_COLOR,
} from "../utils/gameUi";
import {
  calculateNextMultiplier,
  createMinesGame,
  revealCell,
  type MinesState,
} from "../utils/mines";

const { randomUUID } = require("node:crypto") as typeof import("node:crypto");
const logger = require("../utils/logger");
const emoji = require("../utils/emojis");

function boardRows(gameId: string, state: MinesState, revealAll = false): ActionRowBuilder<ButtonBuilder>[] {
  return Array.from({ length: state.gridSize }, (_, row) => {
    const buttons = Array.from({ length: state.gridSize }, (_, column) => {
      const index = row * state.gridSize + column;
      const revealed = state.revealed.includes(index);
      const mine = state.mines.includes(index);
      const button = new ButtonBuilder()
        .setCustomId(`mines|reveal|${gameId}|${index}`)
        .setStyle(revealed ? ButtonStyle.Primary : mine && revealAll ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setDisabled(revealed || revealAll);

      if (revealed || (mine && revealAll)) {
        button.setEmoji(emoji.toComponentEmoji(mine ? "💣" : "💎"));
      } else {
        button.setLabel("·");
      }
      return button;
    });
    return buttonRow(...buttons);
  });
}

function controls(gameId: string, state: MinesState, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return buttonRow(
    gameButton(
      `mines|cashout|${gameId}`,
      `Retirar (${formatCookies(state.bet * state.multiplier)})`,
      "cashout",
      "💰",
      ButtonStyle.Success,
      disabled || state.revealed.length === 0 || state.isGameOver,
    ),
    gameButton(
      `mines|random|${gameId}`,
      "Aleatório",
      "roulette",
      "🎲",
      ButtonStyle.Secondary,
      disabled || state.isGameOver,
    ),
  );
}

function embedFor(gameId: string, state: MinesState, totalCells: number, mineCount: number, color = 0x2b2d31): EmbedBuilder {
  const nextMultiplier = calculateNextMultiplier(totalCells, mineCount, state.revealed.length);
  const nextPayout = state.bet * state.multiplier * nextMultiplier;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle("💣 Mines")
    .setDescription("Encontre os diamantes, evite as minas e retire seus cookies no momento certo.")
    .addFields(
      { name: "🍪 Aposta", value: `**${formatCookies(state.bet)}** cookies`, inline: true },
      { name: "💣 Minas", value: `**${state.mineCount}**`, inline: true },
      { name: "📈 Multiplicador", value: `**${state.multiplier.toFixed(2)}x**`, inline: true },
      { name: "✨ Próxima casa", value: `**${nextMultiplier.toFixed(2)}x** · ${formatCookies(nextPayout)} cookies`, inline: false },
    )
    .setFooter({ text: `Partida #${gameId.slice(0, 8).toUpperCase()}` });
}

async function executeMines(interaction: CommandChatInputInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Este minijogo deve ser iniciado dentro de um servidor.", flags: 64 });
    return;
  }

  const bet = interaction.options.getInteger("aposta") ?? 0;
  const mineCount = interaction.options.getInteger("minas") ?? 3;
  const gridSize = interaction.options.getInteger("tamanho") === 5 ? 5 : 3;
  const totalCells = gridSize * gridSize;

  if (gridSize === 5) {
    await interaction.reply({
      content: "O tabuleiro 5x5 não pode ser exibido junto com os controles: o Discord permite no máximo 5 linhas de componentes. Use o tabuleiro 3x3.",
      flags: 64,
    });
    return;
  }

  if (!Number.isSafeInteger(bet) || bet < 0) {
    await interaction.reply({ content: "A aposta deve ser um número inteiro não negativo.", flags: 64 });
    return;
  }
  if (mineCount < 1 || mineCount >= totalCells) {
    await interaction.reply({ content: `Escolha entre 1 e ${totalCells - 1} minas para um tabuleiro ${gridSize}x${gridSize}.`, flags: 64 });
    return;
  }

  const gameId = randomUUID();
  const context = contextFor(interaction);
  if (!activeGames.reserveNew([interaction.user.id], gameId)) {
    await interaction.reply({
      content: "Você já possui uma partida ativa em outro minijogo. Finalize-a ou aguarde a expiração automática.",
      flags: 64,
    });
    return;
  }

  let stakeReserved = false;
  let state = createMinesGame(bet, mineCount, gridSize);
  let finished = false;
  let processing = false;

  try {
    if (bet > 0) {
      const reservation = reserveStakes(gameId, [{
        userId: interaction.user.id,
        username: interaction.user.username,
        amount: bet,
      }], context);
      if (!reservation.ok) {
        activeGames.releaseGame(gameId);
        await interaction.reply({ content: `Saldo insuficiente. Seu saldo atual é ${formatCookies(reservation.balance ?? 0)} cookies.`, flags: 64 });
        return;
      }
      stakeReserved = true;
    }

    await interaction.reply({
      embeds: [embedFor(gameId, state, totalCells, mineCount)],
      components: [...boardRows(gameId, state), controls(gameId, state)],
    });
    const message = await interaction.fetchReply() as Message;
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: IDLE_TIMEOUT_MS,
    });

    const finish = (outcome: "win" | "loss" | "refund", payout: number, note: string): void => {
      if (finished) return;
      finished = true;
      collector.stop(outcome);
      if (stakeReserved) {
        resolveGame(gameId, [{
          userId: interaction.user.id,
          username: interaction.user.username,
          outcome,
          payout,
          note,
        }], context);
      }
      activeGames.releaseGame(gameId);
    };

    collector.on("collect", async (button: ButtonInteraction) => {
      if (button.user.id !== interaction.user.id) {
        await button.reply({ content: "Esta partida pertence a outro usuário.", flags: 64 });
        return;
      }
      if (processing || finished) return;
      processing = true;
      try {
        const [, action, id, rawIndex] = button.customId.split("|");
        if (id !== gameId) return;
        const index = action === "random"
          ? (() => {
            const available = Array.from({ length: totalCells }, (_, value) => value)
              .filter(value => !state.revealed.includes(value));
            return available[Math.floor(Math.random() * available.length)] ?? -1;
          })()
          : Number(rawIndex);
        if (action !== "reveal" && action !== "random" && action !== "cashout") {
          await button.reply({ content: "Ação inválida para esta partida.", flags: 64 });
          return;
        }
        if (action === "cashout") {
          const payout = Math.floor(state.bet * state.multiplier);
          finish("win", payout, "/mines retirada");
          await button.update({
            embeds: [embedFor(gameId, state, totalCells, mineCount, WIN_COLOR).setDescription("Retirada realizada com sucesso.")],
            components: boardRows(gameId, state, true),
          });
          return;
        }

        if (index < 0 || index >= totalCells || !Number.isInteger(index)) {
          await button.reply({ content: "Essa casa não é válida nesta partida.", flags: 64 });
          return;
        }

        state = revealCell(state, index);
        if (state.isGameOver) {
          const payout = state.isVictory ? Math.floor(state.bet * state.multiplier) : 0;
          finish(state.isVictory ? "win" : "loss", payout, state.isVictory ? "/mines vitória" : "/mines explosão");
          await button.update({
            embeds: [embedFor(gameId, state, totalCells, mineCount, state.isVictory ? WIN_COLOR : LOSS_COLOR)],
            components: boardRows(gameId, state, true),
          });
          return;
        }
        await button.update({
          embeds: [embedFor(gameId, state, totalCells, mineCount)],
          components: [...boardRows(gameId, state), controls(gameId, state)],
        });
      } catch (error) {
        logger.error("Erro no minijogo Mines", error);
        if (stakeReserved && !finished) {
          try { finish("refund", 0, "/mines erro"); } catch (refundError) { logger.error("Falha ao estornar Mines", refundError); }
        }
        if (!button.replied && !button.deferred) await button.reply({ content: "Ocorreu um erro interno. A aposta foi estornada.", flags: 64 }).catch(() => undefined);
      } finally {
        processing = false;
      }
    });

    collector.once("end", (_collected, reason) => {
      if (finished) return;
      try {
        finish("refund", 0, `/mines ${reason || "expirada"}`);
        void message.edit({
          embeds: [embedFor(gameId, state, totalCells, mineCount, LOSS_COLOR).setDescription("Partida encerrada por inatividade. A aposta foi estornada.")],
          components: boardRows(gameId, state, true),
        });
      } catch (error) {
        logger.error("Falha ao encerrar Mines", error);
      }
    });
  } catch (error) {
    activeGames.releaseGame(gameId);
    if (stakeReserved) refundGameBets(gameId, context);
    throw error;
  }
}

module.exports = defineCommand({
  category: "games",
  data: new SlashCommandBuilder()
    .setName("mines")
    .setDescription("Desafie sua sorte no Campo Minado e multiplique seus cookies")
    .setDMPermission(false)
    .addIntegerOption(option => option.setName("aposta").setDescription("Valor da aposta").setMinValue(0).setMaxValue(1_000_000).setRequired(false))
    .addIntegerOption(option => option.setName("minas").setDescription("Quantidade de minas").setMinValue(1).setMaxValue(24).setRequired(false))
    .addIntegerOption(option => option.setName("tamanho").setDescription("Tamanho do tabuleiro").setRequired(false).addChoices({ name: "3x3", value: 3 }, { name: "5x5", value: 5 })),
  execute: executeMines,
});
