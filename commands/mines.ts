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

const { randomUUID, randomInt } = require("node:crypto") as typeof import("node:crypto");
const logger = require("../utils/logger");
const emoji = require("../utils/emojis");

const GRID_SIZE = 3;
const MAX_MINES = GRID_SIZE * GRID_SIZE - 1;

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

function embedFor(
  gameId: string,
  state: MinesState,
  totalCells: number,
  mineCount: number,
  color = 0x2b2d31,
): EmbedBuilder {
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

async function replyToBusyInteraction(button: ButtonInteraction, content: string): Promise<void> {
  if (button.replied || button.deferred) return;
  await button.reply({ content, flags: 64 }).catch(() => undefined);
}

async function executeMines(interaction: CommandChatInputInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Este minijogo deve ser iniciado dentro de um servidor.", flags: 64 });
    return;
  }

  const bet = interaction.options.getInteger("aposta") ?? 0;
  const mineCount = interaction.options.getInteger("minas") ?? 3;
  const totalCells = GRID_SIZE * GRID_SIZE;

  if (!Number.isSafeInteger(bet) || bet < 0 || bet > 1_000_000) {
    await interaction.reply({ content: "A aposta deve ser um inteiro entre 0 e 1.000.000 cookies.", flags: 64 });
    return;
  }
  if (!Number.isSafeInteger(mineCount) || mineCount < 1 || mineCount > MAX_MINES) {
    await interaction.reply({ content: `Escolha entre 1 e ${MAX_MINES} minas para o tabuleiro 3x3.`, flags: 64 });
    return;
  }

  const gameId = randomUUID();
  const context = contextFor(interaction);
  // Construir o estado antes de reservar o jogador evita deixar uma reserva
  // em memória caso a configuração do jogo seja inválida.
  const initialState = createMinesGame(bet, mineCount, GRID_SIZE);

  if (!activeGames.reserveNew([interaction.user.id], gameId)) {
    await interaction.reply({
      content: "Você já possui uma partida ativa em outro minijogo. Finalize-a ou aguarde a expiração automática.",
      flags: 64,
    });
    return;
  }

  let stakeReserved = false;
  let state = initialState;
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
        await interaction.reply({
          content: `Saldo insuficiente. Seu saldo atual é ${formatCookies(reservation.balance ?? 0)} cookies.`,
          flags: 64,
        });
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

      // Um estorno devolve o hold diretamente. Não chamar resolveGame com
      // payout 0: resolveGame exige que refund devolva exatamente a aposta.
      if (stakeReserved) {
        if (outcome === "refund") {
          refundGameBets(gameId, context);
        } else {
          resolveGame(gameId, [{
            userId: interaction.user.id,
            username: interaction.user.username,
            outcome,
            payout,
            note,
          }], context);
        }
        stakeReserved = false;
      }

      finished = true;
      collector.stop(outcome);
      activeGames.releaseGame(gameId);
    };

    collector.on("collect", async (button: ButtonInteraction) => {
      if (button.user.id !== interaction.user.id) {
        await replyToBusyInteraction(button, "Esta partida pertence a outro usuário.");
        return;
      }
      if (processing || finished) {
        await replyToBusyInteraction(button, "Aguarde o processamento da jogada atual.");
        return;
      }

      processing = true;
      try {
        const [command, action, id, rawIndex] = button.customId.split("|");
        if (command !== "mines" || id !== gameId) {
          await replyToBusyInteraction(button, "Este botão não pertence a esta partida.");
          return;
        }
        if (action !== "reveal" && action !== "random" && action !== "cashout") {
          await replyToBusyInteraction(button, "Ação inválida para esta partida.");
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

        const index = action === "random"
          ? (() => {
            const available = Array.from({ length: totalCells }, (_, value) => value)
              .filter((value) => !state.revealed.includes(value));
            return available.length > 0 ? available[randomInt(available.length)] : -1;
          })()
          : Number(rawIndex);

        if (!Number.isInteger(index) || index < 0 || index >= totalCells) {
          await replyToBusyInteraction(button, "Essa casa não é válida nesta partida.");
          return;
        }

        state = revealCell(state, index);
        if (state.isGameOver) {
          const won = state.isVictory;
          const payout = won ? Math.floor(state.bet * state.multiplier) : 0;
          finish(won ? "win" : "loss", payout, won ? "/mines vitória" : "/mines explosão");
          await button.update({
            embeds: [embedFor(gameId, state, totalCells, mineCount, won ? WIN_COLOR : LOSS_COLOR)],
            components: boardRows(gameId, state, true),
          });
          return;
        }

        await button.update({
          embeds: [embedFor(gameId, state, totalCells, mineCount)],
          components: [...boardRows(gameId, state), controls(gameId, state)],
        });
      } catch (error) {
        logger.error("Erro no minijogo Mines", error, { gameId, userId: button.user.id });

        if (!finished) {
          let refundSucceeded = !stakeReserved;
          if (stakeReserved) {
            try {
              refundGameBets(gameId, context);
              stakeReserved = false;
              refundSucceeded = true;
            } catch (refundError) {
              logger.error("Falha ao estornar Mines", refundError, { gameId });
            }
          }
          finished = true;
          collector.stop("error");
          activeGames.releaseGame(gameId);
          const messageText = refundSucceeded
            ? "Ocorreu um erro interno. A aposta foi estornada."
            : "Ocorreu um erro e não consegui confirmar o estorno. A equipe deverá verificar a reserva da partida.";
          await replyToBusyInteraction(button, messageText);
          await message.edit({
            embeds: [gameEmbedForFailure(gameId, state, totalCells, mineCount, messageText)],
            components: boardRows(gameId, state, true),
          }).catch((editError: unknown) => logger.warn("Falha ao atualizar Mines após erro", { gameId, editError }));
        } else {
          // A liquidação já ocorreu; falha ao editar a mensagem não pode gerar
          // um segundo estorno nem uma mensagem dizendo que o pagamento foi revertido.
          await replyToBusyInteraction(button, "A liquidação já foi processada, mas não consegui atualizar o tabuleiro. Confira seu saldo.");
        }
      } finally {
        processing = false;
      }
    });

    collector.once("end", async (_collected, reason) => {
      if (finished) return;
      try {
        finish("refund", 0, `/mines ${reason || "expirada"}`);
        await message.edit({
          embeds: [embedFor(gameId, state, totalCells, mineCount, LOSS_COLOR).setDescription("Partida encerrada por inatividade. A aposta foi estornada.")],
          components: boardRows(gameId, state, true),
        });
      } catch (error) {
        logger.error("Falha ao encerrar Mines ou devolver a aposta", error, { gameId, reason });
        // Mantém o hold persistido para recuperação na inicialização seguinte.
        finished = true;
        activeGames.releaseGame(gameId);
        await message.edit({
          embeds: [embedFor(gameId, state, totalCells, mineCount, LOSS_COLOR).setDescription("Partida encerrada. O estorno ficou pendente de recuperação; contate a equipe se o saldo não retornar.")],
          components: boardRows(gameId, state, true),
        }).catch(() => undefined);
      }
    });
  } catch (error) {
    logger.error("Falha ao iniciar Mines", error, { gameId, userId: interaction.user.id });
    activeGames.releaseGame(gameId);
    if (stakeReserved) {
      try {
        refundGameBets(gameId, context);
        stakeReserved = false;
      } catch (refundError) {
        logger.error("Falha ao devolver aposta após erro de inicialização do Mines", refundError, { gameId });
      }
    }
    throw error;
  }
}

function gameEmbedForFailure(
  gameId: string,
  state: MinesState,
  totalCells: number,
  mineCount: number,
  message: string,
): EmbedBuilder {
  return embedFor(gameId, state, totalCells, mineCount, LOSS_COLOR).setDescription(message);
}

module.exports = defineCommand({
  category: "games",
  data: new SlashCommandBuilder()
    .setName("mines")
    .setDescription("Desafie sua sorte no Campo Minado e multiplique seus cookies")
    .setDMPermission(false)
    .addIntegerOption((option) => option
      .setName("aposta")
      .setDescription("Valor da aposta")
      .setMinValue(0)
      .setMaxValue(1_000_000)
      .setRequired(false))
    .addIntegerOption((option) => option
      .setName("minas")
      .setDescription("Quantidade de minas no tabuleiro 3x3")
      .setMinValue(1)
      .setMaxValue(MAX_MINES)
      .setRequired(false)),
  execute: executeMines,
});