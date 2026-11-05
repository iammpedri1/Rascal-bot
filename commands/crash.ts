import {
  ButtonStyle,
  ComponentType,
  MessageFlags,
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
  gameEmbed,
  IDLE_TIMEOUT_MS,
  LOSS_COLOR,
  WIN_COLOR,
} from "../utils/gameUi";

const { randomUUID, randomInt } = require("node:crypto") as typeof import("node:crypto");

// ---------- constantes ----------
const RTP = 0.95;
const ROLL_RANGE = 1_000_000;
const MULTIPLIER_GROWTH_PER_MS = 1 / 10_000;
const TICK_MS = 1_000;
const MAX_PAYOUT = 2_147_483_647;
const MIN_BET = 1;
const MAX_BET = 2_000_000_000;

const COLOR_PLAYING = 0x5865f2;
const COLOR_CRASH = LOSS_COLOR;
const COLOR_WIN = WIN_COLOR;

const INTERACTION_EXPIRED = 10062;
const INTERACTION_ACKNOWLEDGED = 40060;

// ---------- estados ----------
type GameState = "playing" | "won" | "lost" | "expired";

// ---------- helpers ----------
function isDeadInteractionError(error: unknown): boolean {
  const code = (error as { code?: number })?.code;
  return code === INTERACTION_EXPIRED || code === INTERACTION_ACKNOWLEDGED;
}

async function safeReply(
  interaction: CommandChatInputInteraction,
  content: string,
): Promise<void> {
  try {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  } catch (error) {
    if (!isDeadInteractionError(error)) console.error("[crash] falha em reply:", error);
  }
}

async function safeEditReply(
  interaction: CommandChatInputInteraction,
  payload: Parameters<CommandChatInputInteraction["editReply"]>[0],
): Promise<void> {
  try {
    await interaction.editReply(payload);
  } catch (error) {
    if (!isDeadInteractionError(error)) console.error("[crash] falha em editReply:", error);
  }
}

function crashPoint(): number {
  const roll = randomInt(0, ROLL_RANGE) / ROLL_RANGE;
  const point = RTP / (1 - roll);
  return Math.min(MAX_PAYOUT, Math.max(1, Number(point.toFixed(2))));
}

function buildControls(gameId: string, ended: boolean) {
  return [
    buttonRow(
      gameButton(`crash|cashout|${gameId}`, "Retirar", "cashout", "💰", ButtonStyle.Success, ended),
    ),
  ];
}

// ---------- inicialização ----------
async function executeCrash(interaction: CommandChatInputInteraction): Promise<void> {
  if (interaction.replied || interaction.deferred) return;

  if (!interaction.guild) {
    await safeReply(interaction, "Este minijogo deve ser iniciado dentro de um servidor.");
    return;
  }

  const bet = interaction.options.getInteger("aposta", true);
  const gameId = randomUUID();
  const user = interaction.user;
  const context = contextFor(interaction);

  if (!activeGames.reserveNew([user.id], gameId)) {
    await safeReply(interaction, "Você já possui uma partida ativa em outro minijogo.");
    return;
  }

  try {
    await interaction.deferReply();
  } catch (error) {
    activeGames.releaseGame(gameId);
    if (isDeadInteractionError(error)) {
      console.warn("[crash] interação expirou antes do deferReply; abortando.");
      return;
    }
    throw error;
  }

  const reservation = reserveStakes(
    gameId,
    [{ userId: user.id, username: user.username, amount: bet }],
    context,
  );

  if (!reservation.ok) {
    activeGames.releaseGame(gameId);
    await safeEditReply(interaction, {
      embeds: [
        gameEmbed(
          "Falha na aposta",
          `Saldo insuficiente. Você possui **${formatCookies(reservation.balance ?? 0)} cookies**.`,
          LOSS_COLOR,
        ),
      ],
    });
    return;
  }

  await runGame({ interaction, gameId, bet, user, context });
}

// ---------- fluxo do jogo ----------
interface GameContext {
  interaction: CommandChatInputInteraction;
  gameId: string;
  bet: number;
  user: { id: string; username: string };
  context: ReturnType<typeof contextFor>;
}

async function runGame({ interaction, gameId, bet, user, context }: GameContext): Promise<void> {
  const target = crashPoint();
  const startedAt = Date.now();
  const currentMultiplier = () =>
    Math.min(target, 1 + (Date.now() - startedAt) * MULTIPLIER_GROWTH_PER_MS);

  let state: GameState = "playing";
  let timer: NodeJS.Timeout | undefined;

  const finish = (finalState: GameState) => {
    state = finalState;
    if (timer) clearInterval(timer);
  };

  const renderIntro = () =>
    safeEditReply(interaction, {
      embeds: [
        gameEmbed(
          "🚀 Crash",
          "Multiplicador atual: **1.00x**\nAposte contra a curva e retire antes do crash.",
          COLOR_PLAYING,
        ),
      ],
      components: buildControls(gameId, false),
    });

  const renderPlaying = (multiplier: number) =>
    safeEditReply(interaction, {
      embeds: [
        gameEmbed("🚀 Crash", `Multiplicador atual: **${multiplier.toFixed(2)}x**`, COLOR_PLAYING),
      ],
      components: buildControls(gameId, false),
    });

  const renderCrash = () =>
    safeEditReply(interaction, {
      embeds: [
        gameEmbed(
          "💥 Crash!",
          `A curva explodiu em **${target.toFixed(2)}x**. Você perdeu a aposta.`,
          COLOR_CRASH,
        ),
      ],
      components: buildControls(gameId, true),
    });

  const renderCashout = (multiplier: number, payout: number, balance: number) =>
    safeEditReply(interaction, {
      embeds: [
        gameEmbed(
          "💰 Retirada segura",
          `Você retirou em **${multiplier.toFixed(2)}x** e recebeu **${formatCookies(payout)} cookies**.\nSaldo: **${formatCookies(balance)}**.`,
          COLOR_WIN,
        ),
      ],
      components: buildControls(gameId, true),
    });

  const renderExpired = () =>
    safeEditReply(interaction, {
      embeds: [
        gameEmbed("⏱️ Partida encerrada", "A partida expirou e a aposta foi estornada.", LOSS_COLOR),
      ],
      components: buildControls(gameId, true),
    });

  await renderIntro();

  let message: Message;
  try {
    message = await interaction.fetchReply();
  } catch (error) {
    console.error("[crash] falha ao obter mensagem:", error);
    refundGameBets(gameId, context);
    activeGames.releaseGame(gameId);
    return;
  }

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    idle: IDLE_TIMEOUT_MS,
    filter: (button) => button.customId === `crash|cashout|${gameId}`,
  });

  const handleCrashTick = async (): Promise<void> => {
    if (state !== "playing") return;

    const multiplier = currentMultiplier();
    if (multiplier >= target) {
      finish("lost");
      collector.stop("crash");
      resolveGame(
        gameId,
        [{ userId: user.id, username: user.username, outcome: "loss", payout: 0, note: "/crash · explosão" }],
        context,
      );
      await renderCrash();
      return;
    }
    await renderPlaying(multiplier);
  };

  timer = setInterval(() => {
    void handleCrashTick().catch((error) => {
      console.error("[crash] falha no tick:", error);
      if (state === "playing") {
        finish("expired");
        collector.stop("error");
        refundGameBets(gameId, context);
      }
    });
  }, TICK_MS);
  timer.unref();

  collector.on("collect", async (button: ButtonInteraction) => {
    if (button.user.id !== user.id) {
      try {
        await button.reply({
          content: "Esta partida pertence a outro usuário.",
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        if (!isDeadInteractionError(error)) console.error("[crash] falha em reply do botão:", error);
      }
      return;
    }

    if (state !== "playing") return;

    try {
      await button.deferUpdate();
    } catch (error) {
      if (!isDeadInteractionError(error)) console.error("[crash] falha em deferUpdate:", error);
    }

    finish("won");
    collector.stop("cashout");

    try {
      const multiplier = currentMultiplier();
      const payout = Math.min(MAX_PAYOUT, Math.floor(bet * multiplier));
      const [result] = resolveGame(
        gameId,
        [{ userId: user.id, username: user.username, outcome: "win", payout, note: "/crash · retirada" }],
        context,
      );
      await renderCashout(multiplier, payout, result.balance);
    } catch (error) {
      console.error("[crash] falha ao processar retirada:", error);
    }
  });

  collector.once("end", async () => {
    if (timer) clearInterval(timer);

    if (state === "playing") {
      state = "expired";
      refundGameBets(gameId, context);
      await renderExpired();
    }

    activeGames.releaseGame(gameId);
  });
}

// ---------- definição do comando ----------
module.exports = defineCommand({
  category: "games",
  data: new SlashCommandBuilder()
    .setName("crash")
    .setDescription("Aposte e retire antes da curva explodir")
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName("aposta")
        .setDescription("Valor da aposta")
        .setRequired(true)
        .setMinValue(MIN_BET)
        .setMaxValue(MAX_BET),
    ),
  execute: executeCrash,
});