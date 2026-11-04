import { ButtonStyle, ComponentType, SlashCommandBuilder, type ButtonInteraction } from "discord.js";
import { defineCommand } from "../types/command";
import type { CommandChatInputInteraction } from "../types/command";
import { activeGames } from "../utils/activeGames";
import { refundGameBets, reserveStakes, resolveGame } from "../utils/gameEconomy";
import { buttonRow, contextFor, formatCookies, gameButton, gameEmbed, IDLE_TIMEOUT_MS, LOSS_COLOR, WIN_COLOR } from "../utils/gameUi";

const { randomUUID, randomInt } = require("node:crypto") as typeof import("node:crypto");
const MAX_PAYOUT = 2_147_483_647;

function crashPoint(): number {
  // Distribuição exponencial com RTP de 95% e limite operacional seguro.
  const point = 0.95 / (1 - randomInt(0, 1_000_000) / 1_000_000);
  return Math.min(MAX_PAYOUT, Math.max(1, Number(point.toFixed(2))));
}

function controls(gameId: string, ended = false) {
  return [buttonRow(
    gameButton(`crash|cashout|${gameId}`, "Retirar", "cashout", "💰", ButtonStyle.Success, ended),
  )];
}

async function executeCrash(interaction: CommandChatInputInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Este minijogo deve ser iniciado dentro de um servidor.", flags: 64 });
    return;
  }
  const bet = interaction.options.getInteger("aposta", true);
  const gameId = randomUUID();
  const user = interaction.user;
  const context = contextFor(interaction);
  if (!activeGames.reserveNew([user.id], gameId)) {
    await interaction.reply({ content: "Você já possui uma partida ativa em outro minijogo.", flags: 64 });
    return;
  }

  let settled = false;
  try {
    await interaction.deferReply();
    const reservation = reserveStakes(gameId, [{ userId: user.id, username: user.username, amount: bet }], context);
    if (!reservation.ok) {
      activeGames.releaseGame(gameId);
      await interaction.editReply({ embeds: [gameEmbed("Falha na aposta", `Saldo insuficiente. Você possui **${formatCookies(reservation.balance ?? 0)} cookies**.`, LOSS_COLOR)] });
      return;
    }

    const target = crashPoint();
    const startedAt = Date.now();
    const multiplierAt = () => Math.min(target, 1 + (Date.now() - startedAt) / 10_000);
    const render = (title: string, description: string, color = 0x2b2d31) =>
      interaction.editReply({ embeds: [gameEmbed(title, description, color)], components: controls(gameId, settled) });
    await render("🚀 Crash", `Multiplicador atual: **1.00x**\nAposte contra a curva e retire antes do crash.`, 0x5865f2);
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, idle: IDLE_TIMEOUT_MS });

    const timer = setInterval(async () => {
      if (settled) return;
      const current = multiplierAt();
      if (current >= target) {
        settled = true;
        collector.stop("crash");
        resolveGame(gameId, [{ userId: user.id, username: user.username, outcome: "loss", payout: 0, note: "/crash · explosão" }], context);
        await interaction.editReply({ embeds: [gameEmbed("💥 Crash!", `A curva explodiu em **${target.toFixed(2)}x**. Você perdeu a aposta.`, LOSS_COLOR)], components: controls(gameId, true) });
      } else {
        await interaction.editReply({ embeds: [gameEmbed("🚀 Crash", `Multiplicador atual: **${current.toFixed(2)}x**`, 0x5865f2)], components: controls(gameId) });
      }
    }, 1000);
    timer.unref?.();

    collector.on("collect", async (button: ButtonInteraction) => {
      if (button.user.id !== user.id) {
        await button.reply({ content: "Esta partida pertence a outro usuário.", flags: 64 });
        return;
      }
      if (settled) return;
      await button.deferUpdate();
      settled = true;
      clearInterval(timer);
      collector.stop("cashout");
      const payout = Math.min(MAX_PAYOUT, Math.floor(bet * multiplierAt()));
      const result = resolveGame(gameId, [{ userId: user.id, username: user.username, outcome: "win", payout, note: "/crash · retirada" }], context)[0];
      await interaction.editReply({ embeds: [gameEmbed("💰 Retirada segura", `Você retirou em **${(payout / bet).toFixed(2)}x** e recebeu **${formatCookies(payout)} cookies**.\nSaldo: **${formatCookies(result.balance)}**.`, WIN_COLOR)], components: controls(gameId, true) });
    });
    collector.once("end", () => {
      clearInterval(timer);
      if (!settled) {
        settled = true;
        refundGameBets(gameId, context);
        void interaction.editReply({ embeds: [gameEmbed("⏱️ Partida encerrada", "A partida expirou e a aposta foi estornada.", LOSS_COLOR)], components: controls(gameId, true) });
      }
      activeGames.releaseGame(gameId);
    });
  } catch (error) {
    if (!settled) refundGameBets(gameId, context);
    activeGames.releaseGame(gameId);
    throw error;
  }
}

module.exports = defineCommand({
  category: "games",
  data: new SlashCommandBuilder()
    .setName("crash")
    .setDescription("Aposte e retire antes da curva explodir")
    .setDMPermission(false)
    .addIntegerOption(option => option.setName("aposta").setDescription("Valor da aposta").setRequired(true).setMinValue(1).setMaxValue(2_000_000_000)),
  execute: executeCrash,
});
