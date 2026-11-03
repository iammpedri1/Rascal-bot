import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
  type Message,
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
// URL de placeholder do GIF "Pepe the Frog explodindo" — troque pela sua mídia.
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
        .setDisabled(disabled || picked || revealAll);
      button.setEmoji(picked || (revealAll && isBomb) ? (isBomb ? "💣" : "💎") : "❓");
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

  if (stake < MIN_STAKE) {
    await interaction.reply({
      content: `${icon("crossed", "❌")} A aposta mínima do Mines é **${formatCookies(MIN_STAKE)} cookies**. Use um valor maior.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (mineCount < 1 || mineCount >= MINES_TOTAL_CELLS) {
    await interaction.reply({
      content: `${icon("crossed", "❌")} Escolha entre **1 e 15** minas para o tabuleiro 4x4.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const gameId = `mines-${Date.now()}-${interaction.user.id}`;
  const context = contextFor(interaction);
  if (!activeGames.reserveNew([interaction.user.id], gameId)) {
    await interaction.reply({ content: "Você já está em outro minijogo ativo.", flags: MessageFlags.Ephemeral });
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
    await interaction.deferReply();
    const reservation = reserveStakes(gameId, [{
      userId: player.userId,
      username: player.username,
      amount: stake,
    }], context);
    if (!reservation.ok) {
      await interaction.editReply({
        embeds: [gameEmbed(
          "Aposta não iniciada",
          reservation.reason === "balance"
            ? `Seu saldo é **${formatCookies(reservation.balance ?? 0)} cookies** e não cobre a aposta de **${formatCookies(stake)}**.`
            : "Não consegui reservar a aposta. Tente novamente.",
          LOSS_COLOR,
        )],
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
        await button.reply({ content: "Aguarde a jogada atual ser processada.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
        return;
      }
      if (button.user.id !== player.userId) {
        await button.reply({ content: "Este tabuleiro não é seu! Só quem iniciou a partida pode jogar.", flags: MessageFlags.Ephemeral });
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
            const settled = resolveGame(gameId, [{
              userId: player.userId,
              username: player.username,
              outcome: "loss",
              note: "/mines · bomba",
            }], context)[0];
            finished = true;
            collector.stop("boom");
            await replyMessage.edit({
              embeds: [gameEmbed(
                `${icon("bomb", "💣")} CABUM!`,
                "Você saiu de mãos abanando pois você explodiu...\n\n" +
                  `Aposta perdida: **${formatCookies(stake)} cookies** · Saldo: **${formatCookies(settled.balance)} cookies**.`,
                LOSS_COLOR,
              ).setImage(PEPE_EXPLOSION_GIF)],
              components: boardRows(gameId, grid, [...player.picks, index], true, true),
            });
            return;
          }

          player.picks.push(index);
          const safeCells = MINES_TOTAL_CELLS - player.mineCount;

          if (player.picks.length === safeCells) {
            const finalMultiplier = calculateMultiplier(player.picks.length, player.mineCount);
            const payout = potentialWin(stake, finalMultiplier);
            const settled = resolveGame(gameId, [{
              userId: player.userId,
              username: player.username,
              outcome: "win",
              payout,
              note: "/mines · todos os diamantes",
            }], context)[0];
            finished = true;
            collector.stop("cleared");
            await replyMessage.edit({
              embeds: [gameEmbed(
                `${icon("diamond", "💎")} Todos os diamantes!`,
                `Multiplicador final: **${finalMultiplier.toFixed(2)}x**\n` +
                  `Você retirou **${formatCookies(payout)} cookies**. Saldo: **${formatCookies(settled.balance)} cookies**.`,
                WIN_COLOR,
              )],
              components: boardRows(gameId, grid, player.picks, false, true),
            });
            return;
          }

          const currentMultiplier = calculateMultiplier(player.picks.length, player.mineCount);
          await replyMessage.edit({
            embeds: [gameEmbed(
              `${icon("diamond", "💎")} Diamante encontrado!`,
              buildDescription(player, currentMultiplier),
              WIN_COLOR,
            )],
            components: [...boardRows(gameId, grid, player.picks, false, false), cashoutRow(gameId, true)],
          });
          return;
        }

        if (player.picks.length === 0) {
          await button.followUp({ content: "Revele ao menos um diamante antes de retirar o saldo.", flags: MessageFlags.Ephemeral });
          return;
        }

        const currentMultiplier = calculateMultiplier(player.picks.length, player.mineCount);
        const payout = potentialWin(stake, currentMultiplier);
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
          embeds: [gameEmbed(
            `${icon("cashout", "💰")} Retirada realizada!`,
            `Multiplicador: **${currentMultiplier.toFixed(2)}x**\n` +
              `Você retirou **${formatCookies(payout)} cookies**. Saldo: **${formatCookies(settled.balance)} cookies**.`,
            WIN_COLOR,
          )],
          components: boardRows(gameId, grid, player.picks, false, true),
        });
      } catch (error) {
        logger.error("Falha durante partida de /mines", error, { gameId, userId: button.user.id });
        if (!finished) {
          try { refundGameBets(gameId, context); } catch (refundError) {
            logger.error("Falha ao devolver aposta de /mines", refundError, { gameId });
          }
          stakeReserved = false;
          finished = true;
          collector.stop("error");
          activeGames.releaseGame(gameId);
          await replyMessage.edit({
            embeds: [gameEmbed("Partida cancelada", "O jogo foi cancelado e a aposta foi devolvida.", LOSS_COLOR)],
            components: [],
          }).catch(() => undefined);
        }
      } finally {
        processing = false;
      }
    });

    collector.on("end", (_collected, reason) => {
      if (finished) return;
      finished = true;
      try {
        const refunds = refundGameBets(gameId, context);
        if (refunds.length) stakeReserved = false;
        void replyMessage.edit({
          embeds: [gameEmbed(
            "Tempo esgotado",
            refunds.length
              ? `Você ficou inativo e a aposta de **${formatCookies(refunds[0].stake)} cookies** foi devolvida.`
              : "A partida expirou.",
            0x747f8d,
          )],
          components: [],
        }).catch(() => undefined);
      } catch (error) {
        logger.error("Falha ao devolver aposta após inatividade na /mines", error, { gameId, reason });
      }
      activeGames.releaseGame(gameId);
    });
  } catch (error) {
    logger.error("Falha ao iniciar /mines", error, { gameId, userId: player.userId });
    if (stakeReserved) {
      try { refundGameBets(gameId, context); } catch (refundError) {
        logger.error("Falha ao devolver aposta de /mines", refundError, { gameId });
      }
    }
    activeGames.releaseGame(gameId);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        embeds: [gameEmbed(
          "Partida cancelada",
          "Não consegui iniciar o Mines. A aposta foi devolvida se chegou a ser reservada.",
          LOSS_COLOR,
        )],
        components: [],
      }).catch(() => undefined);
    }
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
      .setDescription("Quantidade de minas no tabuleiro 4x4 (1 a 15)")
      .setMinValue(1)
      .setMaxValue(15)
      .setRequired(true)),

  async execute(interaction: CommandChatInputInteraction): Promise<void> {
    await playMines(interaction);
  },
});
