import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  SlashCommandBuilder,
  type ButtonInteraction,
  type Message,
} from "discord.js";
import { defineCommand } from "../types/command";
import type { CommandChatInputInteraction } from "../types/command";
import type { Logger } from "../types/logger";
import { activeGames } from "../utils/activeGames";
import { refundGameBets, reserveStakes, resolveGame } from "../utils/gameEconomy";
import {
  buttonRow,
  contextFor,
  formatCookies,
  gameButton,
  gameEmbed,
  icon,
  IDLE_TIMEOUT_MS,
  LOSS_COLOR,
  WIN_COLOR,
  DRAW_COLOR,
} from "../utils/gameUi";

const { randomUUID } = require("node:crypto") as typeof import("node:crypto");
const logger = require("../utils/logger") as Logger;
const emoji = require("../utils/emojis") as typeof import("../utils/emojis");

// Helper to map a mark ('x' or 'o') to the corresponding player ID
function playerFor(mark: string, challengerId: string, opponentId: string): string {
  return mark === "x" ? challengerId : opponentId;
}


type Mark = "x" | "o";
type Cell = Mark | null;

const WINNING_LINES: readonly (readonly number[])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winnerOf(board: readonly Cell[]): Mark | null {
  for (const [first, second, third] of WINNING_LINES) {
    const mark = board[first];
    if (mark && mark === board[second] && mark === board[third]) return mark;
  }
  return null;
}

function boardRows(gameId: string, board: readonly Cell[], disabled: boolean): ActionRowBuilder<ButtonBuilder>[] {
  return [0, 1, 2].map((row) => {
    const buttons = [0, 1, 2].map((column) => {
      const index = row * 3 + column;
      const mark = board[index];
      const button = new ButtonBuilder()
        .setCustomId(`jogodavelha|celula|${gameId}|${index}`)
        .setLabel(mark === "x" ? "X" : mark === "o" ? "O" : "·")
        .setStyle(mark === "x" ? ButtonStyle.Primary : mark === "o" ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setDisabled(disabled || mark !== null);
      if (mark === "x") return button.setEmoji(emoji.toComponentEmoji(icon("cross", "❌")));
      if (mark === "o") return button.setEmoji(emoji.toComponentEmoji(icon("circle", "⭕")));
      return button;
    });
    return buttonRow(...buttons);
  });
}

module.exports = defineCommand({
  category: "games",
  data: new SlashCommandBuilder()
    .setName("jogodavelha")
    .setDescription("Desafie um membro para uma partida estratégica de Jogo da Velha")
    .addUserOption((option) => option
      .setName("usuario")
      .setDescription("Usuário que deseja desafiar")
      .setRequired(true))
    .addIntegerOption((option) => option
      .setName("aposta")
      .setDescription("Aposta opcional por jogador")
      .setMinValue(1)
      .setMaxValue(1_000_000_000)
      .setRequired(false)),
  async execute(interaction: CommandChatInputInteraction): Promise<void> {
    await executeTicTacToe(interaction);
  },
});

async function executeTicTacToe(interaction: CommandChatInputInteraction): Promise<void> {
  const opponent = interaction.options.getUser("usuario", true);
  const challenger = interaction.user;
  const bet = interaction.options.getInteger("aposta") ?? 0;
  const gameId = randomUUID();
  const context = contextFor(interaction);

  if (!interaction.guild) {
    await interaction.reply({ content: "Este minijogo deve ser iniciado dentro de um servidor.", flags: 64 });
    return;
  }
  if (opponent.id === challenger.id || opponent.bot) {
    await interaction.reply({ content: "Por favor, desafie outro membro. O Jogo da Velha requer dois participantes.", flags: 64 });
    return;
  }
  if (!activeGames.reserveNew([challenger.id, opponent.id], gameId)) {
    await interaction.reply({ content: "Um dos participantes já está em outro minijogo.", flags: 64 });
    return;
  }

  const board: Cell[] = Array<Cell>(9).fill(null);
  let phase: "invite" | "playing" = "invite";
  let currentMark: Mark = "x";
  let stakeReserved = false;
  let settled = false;
  let finished = false;
  let processing = false;
  let message: Message;

  try {
    await interaction.reply({
      content: `${opponent}`,
      embeds: [gameEmbed(
        `${icon("gamesIcon", "🎮")} Jogo da Velha`,
        [
          `${challenger} desafiou ${opponent}.`,
          bet > 0 ? `${icon("cookie", "🍪")} Aposta por jogador: **${formatCookies(bet)} cookies**.` : "Partida amistosa, sem aposta.",
          `${opponent}, aceite para iniciar. O desafiante joga com X.`,
        ].join("\n\n"),
      )],
      components: [buttonRow(
        gameButton(`jogodavelha|aceitar|${gameId}`, "Aceitar", "correct", "✅", ButtonStyle.Success),
        gameButton(`jogodavelha|recusar|${gameId}`, "Recusar", "crossed", "❌", ButtonStyle.Danger),
      )],
    });
    message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: IDLE_TIMEOUT_MS,
    });

    collector.on("collect", async (button: ButtonInteraction) => {
      if (processing || finished) {
        await button.reply({ content: "Aguarde o processamento da jogada atual.", flags: 64 }).catch(() => undefined);
        return;
      }
      const [command, action, id, rawIndex] = button.customId.split("|");
      if (command !== "jogodavelha" || id !== gameId) return;
      if (![challenger.id, opponent.id].includes(button.user.id)) {
        await button.reply({ content: "Esta partida pertence a outros jogadores.", flags: 64 });
        return;
      }
      processing = true;
      try {
        if (phase === "invite") {
          if (button.user.id !== opponent.id) {
            await button.reply({ content: "Apenas o usuário desafiado tem permissão para responder.", flags: 64 });
            return;
          }
          if (action === "recusar") {
            finished = true;
            collector.stop("declined");
            activeGames.releaseGame(gameId);
            await button.update({
              content: "",
              embeds: [gameEmbed("Desafio recusado", `${opponent} recusou a partida.`, LOSS_COLOR)],
              components: [],
            });
            return;
          }
          if (action !== "aceitar") return;
          if (bet > 0) {
            const reservation = reserveStakes(gameId, [
              { userId: challenger.id, username: challenger.username, amount: bet },
              { userId: opponent.id, username: opponent.username, amount: bet },
            ], context);
            if (!reservation.ok) {
              finished = true;
              collector.stop("balance");
              activeGames.releaseGame(gameId);
              await button.update({
                content: "",
                embeds: [gameEmbed("Aposta cancelada", "Saldo insuficiente para um dos participantes. A aposta foi cancelada.", LOSS_COLOR)],
                components: [],
              });
              return;
            }
            stakeReserved = true;
          }
          phase = "playing";
          await button.update({
            content: "",
            embeds: [gameEmbed(
              `${icon("gamesIcon", "🎮")} É a vez de ${challenger.username}`,
              `${icon("cross", "❌")} ${challenger} joga com X.\n${icon("circle", "⭕")} ${opponent} joga com O.\n\n` +
              (bet > 0 ? `Prêmio: **${formatCookies(bet * 2)} cookies**.` : "Faça três em linha para vencer."),
            )],
            components: boardRows(gameId, board, false),
          });
          return;
        }

        if (phase !== "playing" || action !== "celula") return;
        const expectedUser = playerFor(currentMark, challenger.id, opponent.id);
        if (button.user.id !== expectedUser) {
          await button.reply({ content: "Por favor, aguarde a sua vez de jogar.", flags: 64 });
          return;
        }
        const index = Number(rawIndex);
        if (!Number.isInteger(index) || index < 0 || index >= board.length || board[index] !== null) {
          await button.reply({ content: "Movimento inválido: a posição informada já está ocupada ou é inexistente.", flags: 64 });
          return;
        }

        board[index] = currentMark;
        const winner = winnerOf(board);
        const draw = !winner && board.every((cell) => cell !== null);
        if (winner || draw) {
          const winningUser = winner ? playerFor(winner, challenger.id, opponent.id) : null;
          let balances: ReturnType<typeof resolveGame> = [];
          if (stakeReserved) {
            balances = resolveGame(gameId, winner
              ? [
                { userId: challenger.id, username: challenger.username, outcome: winningUser === challenger.id ? "win" : "loss", payout: winningUser === challenger.id ? bet * 2 : 0, note: "/jogodavelha" },
                { userId: opponent.id, username: opponent.username, outcome: winningUser === opponent.id ? "win" : "loss", payout: winningUser === opponent.id ? bet * 2 : 0, note: "/jogodavelha" },
              ]
              : [
                { userId: challenger.id, username: challenger.username, outcome: "draw", payout: bet, note: "/jogodavelha empatado" },
                { userId: opponent.id, username: opponent.username, outcome: "draw", payout: bet, note: "/jogodavelha empatado" },
              ], context);
          } else {
            const results = winner
              ? [
                { userId: challenger.id, username: challenger.username, outcome: winningUser === challenger.id ? "win" as const : "loss" as const, note: "/jogodavelha" },
                { userId: opponent.id, username: opponent.username, outcome: winningUser === opponent.id ? "win" as const : "loss" as const, note: "/jogodavelha" },
              ]
              : [
                { userId: challenger.id, username: challenger.username, outcome: "draw" as const, note: "/jogodavelha empatado" },
                { userId: opponent.id, username: opponent.username, outcome: "draw" as const, note: "/jogodavelha empatado" },
              ];
            balances = resolveGame(gameId, results, context);
          }
          settled = true;
          stakeReserved = false;
          finished = true;
          collector.stop("finished");
          const description = [
            winner
              ? `${icon("trophy", "🏆")} ${winningUser === challenger.id ? challenger : opponent} consagrou-se vencedor!`
              : `${icon("handshake", "🤝")} Empate (Velha)!`,
            ...(bet > 0 ? balances.map((balance) => `${icon("cookie", "🍪")} <@${balance.userId}>: **${formatCookies(balance.balance)} cookies**`) : []),
          ].join("\n\n");
          await button.update({
            embeds: [gameEmbed("Jogo da Velha · Resultado", description, winner ? WIN_COLOR : DRAW_COLOR)],
            components: boardRows(gameId, board, true),
          });
          activeGames.releaseGame(gameId);
          return;
        }

        currentMark = currentMark === "x" ? "o" : "x";
        const nextId = playerFor(currentMark, challenger.id, opponent.id);
        await button.update({
          embeds: [gameEmbed(
            `${icon("gamesIcon", "🎮")} É a vez de ${currentMark === "x" ? challenger.username : opponent.username}`,
            `${icon(currentMark === "x" ? "cross" : "circle", currentMark === "x" ? "❌" : "⭕")} <@${nextId}> joga agora.`,
          )],
          components: boardRows(gameId, board, false),
        });
      } catch (error) {
        logger.error("Falha durante partida de /jogodavelha", error, { gameId, userId: button.user.id });
        if (stakeReserved && !settled) {
          try { refundGameBets(gameId, context); } catch (refundError) {
            logger.error("Falha ao devolver aposta do /jogodavelha", refundError, { gameId });
          }
        }
        finished = true;
        collector.stop("error");
        activeGames.releaseGame(gameId);
        await message.edit({
          content: "",
          embeds: [gameEmbed("Partida cancelada", "Não foi possível finalizar a partida. As apostas reservadas foram estornadas.", LOSS_COLOR)],
          components: boardRows(gameId, board, true),
        }).catch(() => undefined);
        if (button.deferred || button.replied) {
          await button.followUp({ content: "A partida foi cancelada. As apostas reservadas foram estornadas.", flags: 64 }).catch(() => undefined);
        }
      } finally {
        processing = false;
      }
    });

    collector.on("end", (_collected, reason) => {
      if (finished) return;
      finished = true;
      if (stakeReserved) {
        try { refundGameBets(gameId, context); } catch (error) {
          logger.error("Falha ao devolver aposta após expiração do /jogodavelha", error, { gameId });
        }
      }
      activeGames.releaseGame(gameId);
      void message.edit({
        content: "",
        embeds: [gameEmbed(
          phase === "playing" ? "Partida encerrada por inatividade" : "Desafio expirado",
          phase === "playing" ? "Tempo de inatividade atingido. As apostas foram estornadas." : "O convite de desafio expirou.",
          0x747f8d,
        )],
        components: phase === "playing" ? boardRows(gameId, board, true) : [],
      }).catch((error: unknown) => logger.warn("Não consegui atualizar a partida expirada", { reason, error }));
    });
  } catch (error) {
    activeGames.releaseGame(gameId);
    logger.error("Falha ao criar desafio de /jogodavelha", error, { gameId });
    throw error;
  }
}
