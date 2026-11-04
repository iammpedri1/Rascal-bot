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

type Move = "pedra" | "papel" | "tesoura";
type DuelWinner = "challenger" | "opponent" | "draw";

const MOVE_DATA: Record<Move, { label: string; emoji: string; icon: string; beats: Move }> = {
  pedra: { label: "Pedra", emoji: "🪨", icon: "rock", beats: "tesoura" },
  papel: { label: "Papel", emoji: "📄", icon: "paper", beats: "pedra" },
  tesoura: { label: "Tesoura", emoji: "✂️", icon: "scissors", beats: "papel" },
};

function invitationRow(gameId: string): ActionRowBuilder<ButtonBuilder> {
  return buttonRow(
    gameButton(`jokenpo|aceitar|${gameId}`, "Aceitar", "correct", "✅", ButtonStyle.Success),
    gameButton(`jokenpo|recusar|${gameId}`, "Recusar", "crossed", "❌", ButtonStyle.Danger),
  );
}

function moveRow(gameId: string): ActionRowBuilder<ButtonBuilder> {
  return buttonRow(
    gameButton(`jokenpo|jogada|${gameId}|pedra`, "Pedra", "rock", "🪨", ButtonStyle.Secondary),
    gameButton(`jokenpo|jogada|${gameId}|papel`, "Papel", "paper", "📄", ButtonStyle.Secondary),
    gameButton(`jokenpo|jogada|${gameId}|tesoura`, "Tesoura", "scissors", "✂️", ButtonStyle.Secondary),
  );
}

function winnerFor(first: Move, second: Move): DuelWinner {
  if (first === second) return "draw";
  return MOVE_DATA[first].beats === second ? "challenger" : "opponent";
}

async function executeJokenpo(interaction: CommandChatInputInteraction): Promise<void> {
  const opponent = interaction.options.getUser("usuario", true);
  const bet = interaction.options.getInteger("aposta") ?? 0;
  const challenger = interaction.user;
  const gameId = randomUUID();
  const context = contextFor(interaction);

  if (!interaction.guild) {
    await interaction.reply({ content: "Este minijogo deve ser iniciado dentro de um servidor.", flags: 64 });
    return;
  }
  if (opponent.id === challenger.id || opponent.bot) {
    await interaction.reply({ content: "Por favor, desafie outro membro. O Jokenpô requer dois participantes.", flags: 64 });
    return;
  }
  if (!activeGames.reserveNew([challenger.id, opponent.id], gameId)) {
    await interaction.reply({
      content: `${icon("crossed", "❌")} Um dos participantes já está em outro minijogo.`,
      flags: 64,
    });
    return;
  }

  const moves = new Map<string, Move>();
  let phase: "invite" | "playing" = "invite";
  let stakeReserved = false;
  let settled = false;
  let finished = false;
  let processing = false;

  try {
    await interaction.reply({
      content: `${opponent}`,
      embeds: [gameEmbed(
        `${icon("gamesIcon", "🎮")} Pedra, Papel e Tesoura (Jokenpô)`,
        [
          `${challenger} desafiou ${opponent}.`,
          bet > 0 ? `${icon("cookie", "🍪")} Aposta por jogador: **${formatCookies(bet)} cookies**.` : "Partida amistosa, sem aposta.",
          `${opponent}, aceite para realizar sua jogada.`,
        ].join("\n\n"),
      )],
      components: [invitationRow(gameId)],
    });
    const message: Message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: IDLE_TIMEOUT_MS,
    });

    collector.on("collect", async (button: ButtonInteraction) => {
      if (processing) {
        await button.reply({ content: "Aguarde o processamento da jogada atual.", flags: 64 }).catch(() => undefined);
        return;
      }
      const [command, action, id, rawMove] = button.customId.split("|");
      if (command !== "jokenpo" || id !== gameId) return;

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
              `${icon("gamesIcon", "🎮")} Realizem suas jogadas em segredo`,
              [
                `${challenger} e ${opponent}, façam uma escolha nos botões abaixo.`,
                "As jogadas permanecerão ocultas até que ambos os participantes confirmem.",
                bet > 0 ? `${icon("cookie", "🍪")} Aposta total: **${formatCookies(bet * 2)} cookies**.` : "Partida amistosa, sem aposta.",
              ].join("\n\n"),
            )],
            components: [moveRow(gameId)],
          });
          return;
        }

        if (phase !== "playing" || action !== "jogada") return;
        if (moves.has(button.user.id)) {
          await button.reply({ content: "Sua escolha já foi processada e permanece em sigilo.", flags: 64 });
          return;
        }
        if (!(rawMove in MOVE_DATA)) {
          await button.reply({ content: "Essa jogada não é válida.", flags: 64 });
          return;
        }

        moves.set(button.user.id, rawMove as Move);
        await button.deferUpdate();
        if (moves.size < 2) {
          await button.followUp({ content: "Sua jogada foi registrada com sucesso e permanece oculta.", flags: 64 });
          return;
        }

        const challengerMove = moves.get(challenger.id);
        const opponentMove = moves.get(opponent.id);
        if (!challengerMove || !opponentMove) throw new Error("Uma das jogadas não foi encontrada.");
        const outcome = winnerFor(challengerMove, opponentMove);
        const results = outcome === "draw"
          ? [
            { userId: challenger.id, username: challenger.username, outcome: "draw" as const, payout: bet, note: "/jokenpo empatado" },
            { userId: opponent.id, username: opponent.username, outcome: "draw" as const, payout: bet, note: "/jokenpo empatado" },
          ]
          : [
            {
              userId: challenger.id,
              username: challenger.username,
              outcome: outcome === "challenger" ? "win" as const : "loss" as const,
              payout: outcome === "challenger" ? bet * 2 : 0,
              note: "/jokenpo",
            },
            {
              userId: opponent.id,
              username: opponent.username,
              outcome: outcome === "opponent" ? "win" as const : "loss" as const,
              payout: outcome === "opponent" ? bet * 2 : 0,
              note: "/jokenpo",
            },
          ];
        const balances = resolveGame(gameId, results, context);
        settled = true;
        finished = true;
        collector.stop("finished");

        const winnerId = outcome === "challenger" ? challenger.id : outcome === "opponent" ? opponent.id : null;
        const description = [
          `${challenger}: ${icon(MOVE_DATA[challengerMove].icon, MOVE_DATA[challengerMove].emoji)} **${MOVE_DATA[challengerMove].label}**`,
          `${opponent}: ${icon(MOVE_DATA[opponentMove].icon, MOVE_DATA[opponentMove].emoji)} **${MOVE_DATA[opponentMove].label}**`,
          "",
          outcome === "draw"
            ? `${icon("handshake", "🤝")} Empate! As apostas reservadas foram estornadas.`
            : `${icon("trophy", "🏆")} ${winnerId === challenger.id ? challenger : opponent} consagrou-se vencedor e recebeu **${formatCookies(bet * 2)} cookies**.`,
          ...(bet > 0 ? balances.map((balance) => `${icon("cookie", "🍪")} <@${balance.userId}>: **${formatCookies(balance.balance)} cookies**`) : []),
        ].join("\n");

        await message.edit({
          content: "",
          embeds: [gameEmbed(
            outcome === "draw" ? "Jokenpô · Empate" : "Jokenpô · Resultado",
            description,
            outcome === "draw" ? DRAW_COLOR : winnerId ? WIN_COLOR : LOSS_COLOR,
          )],
          components: [],
        });
      } catch (error) {
        logger.error("Falha durante partida de /jokenpo", error, { gameId, userId: button.user.id });
        if (stakeReserved && !settled) {
          try { refundGameBets(gameId, context); } catch (refundError) {
            logger.error("Falha ao devolver aposta do /jokenpo", refundError, { gameId });
          }
        }
        finished = true;
        collector.stop("error");
        activeGames.releaseGame(gameId);
        await message.edit({
          content: "",
          embeds: [gameEmbed("Partida cancelada", "Não foi possível finalizar a partida. As apostas reservadas foram estornadas.", LOSS_COLOR)],
          components: [],
        }).catch(() => undefined);
        if (button.deferred || button.replied) {
          await button.followUp({ content: "A partida foi cancelada. As apostas reservadas foram estornadas.", flags: 64 }).catch(() => undefined);
        }
      } finally {
        processing = false;
      }
    });

    collector.on("end", (collected, reason) => {
      if (finished) return;
      finished = true;
      if (stakeReserved && !settled) {
        try { refundGameBets(gameId, context); } catch (error) {
          logger.error("Falha ao devolver aposta após expiração do /jokenpo", error, { gameId });
        }
      }
      activeGames.releaseGame(gameId);
      const wasPlaying = phase === "playing";
      void message.edit({
        content: "",
        embeds: [gameEmbed(
          wasPlaying ? "Partida encerrada por inatividade" : "Desafio expirado",
          wasPlaying
            ? "O tempo de inatividade terminou. As apostas foram estornadas."
            : "O convite de desafio expirou.",
          0x747f8d,
        )],
        components: [],
      }).catch((error: unknown) => logger.warn("Não consegui atualizar o desafio expirado", { error, reason, collected: collected.size }));
    });
  } catch (error) {
    activeGames.releaseGame(gameId);
    logger.error("Falha ao criar desafio de /jokenpo", error, { gameId });
    throw error;
  }
}

module.exports = defineCommand({
  category: "games",
  data: new SlashCommandBuilder()
    .setName("jokenpo")
    .setDescription("Desafie um membro para uma partida de Jokenpô (Pedra, Papel e Tesoura)")
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
    await executeJokenpo(interaction);
  },
});
