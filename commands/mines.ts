import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
} from "discord.js";
import { defineCommand, type CommandChatInputInteraction } from "../types/command";
import type { Logger } from "../types/logger";
import { activeGames } from "../utils/activeGames";
import { refundGameBets, reserveStakes, resolveGame } from "../utils/gameEconomy";
import {
  calculateMultiplier,
  generateMinesGrid,
  MINES_TOTAL_CELLS,
  type MinesGrid,
} from "../utils/minesLogic";
import {
  contextFor,
  formatCookies,
  gameEmbed,
  icon,
  IDLE_TIMEOUT_MS,
  LOSS_COLOR,
  WIN_COLOR,
} from "../utils/gameUi";

const logger = require("../utils/logger") as Logger;

const MIN_STAKE = 1_000;
const MAX_STAKE = 100_000_000;
const MAX_PAYOUT = 2_147_483_647;
const PEPE_EXPLOSION_GIF = "https://media.tenor.com/m/k6D4n7L3qXoAAAAC/pepe-frog-explode.gif";

interface MinesPlayer {
  userId: string;
  username: string;
  stake: number;
  mineCount: number;
  picks: number[];
}

function potentialWin(stake: number, multiplier: number): number {
  return Math.min(MAX_PAYOUT, Math.floor(stake * multiplier));
}

function boardRows(
  gameId: string,
  grid: MinesGrid,
  picks: readonly number[],
  revealAll: boolean,
  disabled: boolean,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let row = 0; row < 4; row += 1) {
    const buttons: ButtonBuilder[] = [];
    for (let column = 0; column < 4; column += 1) {
      const index = row * 4 + column;
      const isBomb = grid[row][column] === true;
      const picked = picks.includes(index);
      
      const button = new ButtonBuilder()
        .setCustomId(`mines|pick|${gameId}|${index}`)
        .setStyle(
          picked && !isBomb
            ? ButtonStyle.Success
            : picked || (revealAll && isBomb)
              ? ButtonStyle.Danger
              : ButtonStyle.Secondary,
        )
        .setDisabled(disabled || picked || (revealAll && !isBomb));

      // Remove '?' - revealed get emojis, others stay gray and empty
      if (picked || (revealAll && isBomb)) {
        button.setEmoji(isBomb ? "💣" : "💎");
      }
      buttons.push(button);
    }
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));
  }
  return rows;
}

function cashoutRow(gameId: string, enabled: boolean): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`mines|cashout|${gameId}`)
      .setLabel("Retirar Saldo / Cashout")
      .setEmoji("💰")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!enabled),
  );
}

function buildDescription(player: MinesPlayer, multiplier: number): string {
  const safeCells = MINES_TOTAL_CELLS - player.mineCount;
  return [
    `${icon("cookie", "🍪")} Aposta: **${formatCookies(player.stake)} cookies**`,
    `${icon("bomb", "💣")} Minas: **${player.mineCount}** de 16 · Diamantes: **${player.picks.length}/${safeCells}**`,
    `Multiplicador atual: **${multiplier.toFixed(2)}x**`,
    `Retirar agora: **${formatCookies(potentialWin(player.stake, multiplier))} cookies**`,
  ].join("\n");
}

async function playMines(interaction: CommandChatInputInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Este jogo só pode ser iniciado no servidor.", flags: MessageFlags.Ephemeral });
    return;
  }

  const stake = interaction.options.getInteger("aposta") ?? 0;
  const mineCount = interaction.options.getInteger("minas") ?? 0;

  // Simple validations before deferring to keep it fast
  if (stake < MIN_STAKE) {
    await interaction.reply({ content: `${icon("crossed", "❌")} Aposta mínima: **${formatCookies(MIN_STAKE)} cookies**.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (mineCount < 1 || mineCount >= MINES_TOTAL_CELLS) {
    await interaction.reply({ content: `${icon("crossed", "❌")} Escolha entre **1 e 8** minas.`, flags: MessageFlags.Ephemeral });
    return;
  }

  // Defer immediately to avoid "Unknown Interaction"
  await interaction.deferReply();

  const gameId = `mines-${Date.now()}-${interaction.user.id}`;
  const context = contextFor(interaction);

  if (!activeGames.reserveNew([interaction.user.id], gameId)) {
    await interaction.editReply({ content: "Você já está em outro jogo ativo. Termine-o primeiro.", flags: MessageFlags.Ephemeral });
    return;
  }

  let stakeReserved = false;
  let finished = false;
  let processing = false;
  const grid = generateMinesGrid(mineCount);
  const player: MinesPlayer = {
    userId: interaction.user.id,
    username: interaction.user.username,
    stake,
    mineCount,
    picks: [],
  };

  try {
    const reservation = reserveStakes(gameId, [{
      userId: player.userId,
      username: player.username,
      amount: stake,
    }], context);

    if (!reservation.ok) {
      await interaction.editReply({
        content: reservation.reason === "balance" 
          ? `Saldo insuficiente: você tem **${formatCookies(reservation.balance ?? 0)}** e a aposta é **${formatCookies(stake)}**.` 
          : "Erro ao reservar aposta.", 
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    stakeReserved = true;

    const firstMultiplier = calculateMultiplier(0, mineCount);
    await interaction.editReply({
      embeds: [gameEmbed(`${icon("bomb", "💣")} Mines`, buildDescription(player, firstMultiplier))],
      components: [...boardRows(gameId, grid, player.picks, false, false), cashoutRow(gameId, false)],
    });
    const replyMessage = await interaction.fetchReply();

    const collector = replyMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: IDLE_TIMEOUT_MS,
    });

    collector.on("collect", async (button: ButtonInteraction) => {
      if (processing || finished) {
        await button.reply({ content: "Aguarde o processamento...", flags: MessageFlags.Ephemeral }).catch(() => {});
        return;
      }
      if (button.user.id !== player.userId) {
        await button.reply({ content: "Este tabuleiro não é seu!", flags: MessageFlags.Ephemeral });
        return;
      }
      const [, action, id, cellText] = button.customId.split("|");
      if (id !== gameId || (action !== "pick" && action !== "cashout")) return;
      processing = true;

      try {
        await button.deferUpdate();

        if (action === "pick") {
          const index = Number(cellText);
          if (!Number.isInteger(index) || index < 0 || index >= MINES_TOTAL_CELLS || player.picks.includes(index)) return;
          const row = Math.floor(index / 4);
          const column = index % 4;

          if (grid[row][column]) {
            // LOSS
            const settled = resolveGame(gameId, [{
              userId: player.userId,
              username: player.username,
              outcome: "loss",
              note: "/mines · bomba",
            }], context)[0];
            finished = true;
            collector.stop("boom");
            await replyMessage.edit({
              embeds: [gameEmbed(`${icon("bomb", "💣")} CABUM!`, `Você atingiu uma mina e perdeu **${formatCookies(player.stake)} cookies**.`, LOSS_COLOR).setImage(PEPE_EXPLOSION_GIF)],
              components: boardRows(gameId, grid, [...player.picks, index], true, true),
            });
          } else {
            // SAFE
            player.picks.push(index);
            const currentMult = calculateMultiplier(player.picks.length, mineCount);
            if (player.picks.length === (MINES_TOTAL_CELLS - mineCount)) {
              // FULL CLEAR
              const payout = potentialWin(stake, currentMult);
              const settled = resolveGame(gameId, [{
                userId: player.userId,
                username: player.username,
                outcome: "win",
                payout,
                note: "/mines · total",
              }], context)[0];
              finished = true;
              collector.stop("cleared");
              await replyMessage.edit({
                embeds: [gameEmbed(`${icon("diamond", "💎")} LIMPO!`, `Você encontrou todos os diamantes!\nRetirou **${formatCookies(payout)} cookies** (${currentMult.toFixed(2)}x).`, WIN_COLOR)],
                components: boardRows(gameId, grid, player.picks, true, true),
              });
            } else {
              await replyMessage.edit({
                embeds: [gameEmbed(`${icon("diamond", "💎")} Diamante!`, buildDescription(player, currentMult), WIN_COLOR)],
                components: [...boardRows(gameId, grid, player.picks, false, false), cashoutRow(gameId, true)],
              });
            }
          }
        } else if (action === "cashout") {
          if (player.picks.length === 0) {
            await button.followUp({ content: "Revele ao menos um diamante antes de retirar.", flags: MessageFlags.Ephemeral });
            processing = false;
            return;
          }
          const currentMult = calculateMultiplier(player.picks.length, mineCount);
          const payout = potentialWin(stake, currentMult);
          const settled = resolveGame(gameId, [{
            userId: player.userId,
            username: player.username,
            outcome: "win",
            payout,
            note: "/mines · cashout",
          }], context)[0];
          finished = true;
          collector.stop("cashout");
          await replyMessage.edit({
            embeds: [gameEmbed(`${icon("cashout", "💰")} Retirado!`, `Multiplicador: **${currentMult.toFixed(2)}x**\nVocê retirou **${formatCookies(payout)} cookies**.`, WIN_COLOR)],
            components: boardRows(gameId, grid, player.picks, true, true),
          });
        }
      } catch (e) {
        logger.error("Erro na rodada do Mines", e);
      } finally {
        processing = false;
      }
    });
  } catch (error) {
    logger.error("Erro crítico no Mines", error);
  } finally {
    if (!stakeReserved || finished) activeGames.releaseGame(gameId);
  }
}

module.exports = defineCommand({
  category: "games",
  data: new SlashCommandBuilder()
    .setName("mines")
    .setDescription("Jogue Mines: desvende diamantes e desvie das minas")
    .addIntegerOption((option) => option
      .setName("aposta")
      .setDescription("Valor da aposta em cookies (mínimo 1.000)")
      .setMinValue(MIN_STAKE)
      .setMaxValue(MAX_STAKE)
      .setRequired(true))
    .addIntegerOption((option) => option
      .setName("minas")
      .setDescription("Quantidade de minas no tabuleiro (1 a 8)")
      .setMinValue(1)
      .setMaxValue(8)
      .setRequired(true)),

  async execute(interaction: CommandChatInputInteraction): Promise<void> {
    await playMines(interaction);
  },
});