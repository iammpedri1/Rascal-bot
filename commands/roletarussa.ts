import {
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

const { randomUUID, randomInt } = require("node:crypto") as typeof import("node:crypto");
const logger = require("../utils/logger") as Logger;

type PlayerStatus = "active" | "cashed_out" | "shot" | "survived";

interface RoulettePlayer {
  userId: string;
  username: string;
  stake: number;
  safePulls: number;
  status: PlayerStatus;
}

function estimatedPayout(player: RoulettePlayer): number {
  const bonusRate = Math.min(0.8, player.safePulls * 0.2);
  return player.stake + Math.floor(player.stake * bonusRate);
}

function buildDescription(
  players: ReadonlyMap<string, RoulettePlayer>,
  chamber: number,
  gameOver: boolean,
  finalLine = "",
): string {
  const roster = [...players.values()].map((player) => {
    if (player.status === "cashed_out") {
      return `${icon("cashout", "💰")} <@${player.userId}> saiu com **${formatCookies(estimatedPayout(player))} cookies**.`;
    }
    if (player.status === "shot") {
      return `${icon("pand_police", "🚨")} <@${player.userId}> foi atingido e perdeu a aposta.`;
    }
    if (player.status === "survived") {
      return `${icon("correct", "✅")} <@${player.userId}> sobreviveu e recebeu a aposta de volta.`;
    }
    return `${icon("trigger", "🔫")} <@${player.userId}> · ${player.safePulls} sobrevivência(s) · prêmio atual **${formatCookies(estimatedPayout(player))}**`;
  });
  const status = gameOver
    ? "A rodada acabou."
    : `Próxima câmara: **${Math.min(chamber + 1, 6)}/6** · chance do disparo: **${Math.round((1 / Math.max(1, 6 - chamber)) * 100)}%**.`;

  return [
    status,
    `${icon("cookie", "🍪")} Aposta por jogador: **reservada ao entrar**. Cada clique em puxar vale uma rodada.`,
    "",
    roster.length ? roster.join("\n") : "Ninguém entrou ainda. Clique em **Puxar gatilho** para começar.",
    finalLine,
  ].filter(Boolean).join("\n");
}

function gameComponents(gameId: string, ended = false) {
  return [buttonRow(
    gameButton(`roletarussa|puxar|${gameId}`, "Puxar gatilho", "trigger", "🔫", ButtonStyle.Danger, ended),
    gameButton(`roletarussa|sair|${gameId}`, "Pipocar", "cashout", "💰", ButtonStyle.Success, ended),
  )];
}

async function executeRussianRoulette(interaction: CommandChatInputInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Este jogo só pode ser iniciado no servidor.", flags: 64 });
    return;
  }

  const owner = interaction.user;
  const stake = interaction.options.getInteger("aposta") ?? 500;
  const gameId = randomUUID();
  const context = contextFor(interaction);
  if (!activeGames.reserveNew([owner.id], gameId)) {
    await interaction.reply({ content: "Você já está em outro minijogo ativo.", flags: 64 });
    return;
  }

  let stakeReserved = false;
  let finished = false;
  let processing = false;
  let message: Message;
  const chamberWithBullet = randomInt(1, 7);
  let chamber = 0;
  const players = new Map<string, RoulettePlayer>();

  try {
    await interaction.deferReply();
    const reservation = reserveStakes(gameId, [{ userId: owner.id, username: owner.username, amount: stake }], context);
    if (!reservation.ok) {
      await interaction.editReply({
        embeds: [gameEmbed(
          "Aposta não iniciada",
          reservation.reason === "balance"
            ? `Seu saldo é **${formatCookies(reservation.balance ?? 0)} cookies**; não cobre a aposta.`
            : "Não consegui reservar a aposta. Tente novamente.",
          LOSS_COLOR,
        )],
      });
      return;
    }
    stakeReserved = true;
    players.set(owner.id, {
      userId: owner.id,
      username: owner.username,
      stake,
      safePulls: 0,
      status: "active",
    });

    await interaction.editReply({
      embeds: [gameEmbed(
        `${icon("revolver", "🔫")} Roleta-russa`,
        [
          `${owner} entrou com **${formatCookies(stake)} cookies** reservados.`,
          "Cada participante pode puxar o gatilho ou sair depois de sobreviver.",
          buildDescription(players, chamber, false),
        ].join("\n\n"),
      )],
      components: gameComponents(gameId),
    });
    message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      idle: IDLE_TIMEOUT_MS,
    });

    collector.on("collect", async (button: ButtonInteraction) => {
      if (processing || finished) {
        await button.reply({ content: "Aguarde a jogada atual ser processada.", flags: 64 }).catch(() => undefined);
        return;
      }
      const [command, action, id] = button.customId.split("|");
      if (command !== "roletarussa" || id !== gameId) return;
      if (action !== "puxar" && action !== "sair") return;
      processing = true;

      try {
        await button.deferUpdate();
        let player = players.get(button.user.id);

        if (action === "puxar" && !player) {
          if (!activeGames.join(button.user.id, gameId)) {
            await button.followUp({ content: "Você já está em outro minijogo ativo.", flags: 64 });
            return;
          }
          const joined = reserveStakes(gameId, [{
            userId: button.user.id,
            username: button.user.username,
            amount: stake,
          }], context);
          if (!joined.ok) {
            activeGames.releaseUser(button.user.id, gameId);
            await button.followUp({
              content: joined.reason === "balance"
                ? `Você precisa de **${formatCookies(stake)} cookies** para entrar.`
                : "Não consegui registrar sua aposta.",
              flags: 64,
            });
            return;
          }
          player = {
            userId: button.user.id,
            username: button.user.username,
            stake,
            safePulls: 0,
            status: "active",
          };
          players.set(button.user.id, player);
        }

        if (!player || player.status !== "active") {
          await button.followUp({ content: "Você não está participando desta rodada ativa.", flags: 64 });
          return;
        }

        if (action === "sair") {
          if (player.safePulls === 0) {
            await button.followUp({ content: "Sobreviva a pelo menos uma puxada para poder sair com prêmio.", flags: 64 });
            return;
          }
          const payout = estimatedPayout(player);
          const settled = resolveGame(gameId, [{
            userId: player.userId,
            username: player.username,
            outcome: "win",
            payout,
            note: "/roletarussa · saída segura",
          }], context)[0];
          player.status = "cashed_out";
          activeGames.releaseUser(player.userId, gameId);
          await message.edit({
            embeds: [gameEmbed(
              `${icon("cashout", "💰")} ${player.username} saiu em segurança`,
              `${icon("correct", "✅")} Recebeu **${formatCookies(payout)} cookies**. Saldo: **${formatCookies(settled.balance)}**.\n\n` +
                buildDescription(players, chamber, false),
              WIN_COLOR,
            )],
            components: gameComponents(gameId),
          });
          return;
        }

        chamber += 1;
        if (chamber === chamberWithBullet) {
          player.status = "shot";
          const remaining = [...players.values()].filter((entry) => entry.status === "active");
          const results = remaining.map((entry) => ({
            userId: entry.userId,
            username: entry.username,
            outcome: entry.userId === player?.userId ? "loss" as const : "draw" as const,
            note: entry.userId === player?.userId
              ? "/roletarussa · disparo"
              : "/roletarussa · sobreviveu à rodada",
          }));
          const balances = resolveGame(gameId, results, context);
          for (const participant of remaining) {
            if (participant.userId !== player?.userId) participant.status = "survived";
          }
          stakeReserved = false;
          finished = true;
          collector.stop("bullet");
          activeGames.releaseGame(gameId);
          const shooterBalance = balances.find((balance) => balance.userId === player?.userId)?.balance;
          const finalLine = [
            `${icon("pand_police", "🚨")} **BANG!** ${player.username} foi atingido.`,
            `${icon("cookie", "🍪")} Saldo de quem foi atingido: **${formatCookies(shooterBalance ?? 0)} cookies**.`,
            ...balances.filter((balance) => balance.userId !== player?.userId)
              .map((balance) => `${icon("correct", "✅")} <@${balance.userId}> sobreviveu; aposta devolvida. Saldo: **${formatCookies(balance.balance)} cookies**.`),
          ].join("\n");
          await message.edit({
            embeds: [gameEmbed("Fim da rodada", buildDescription(players, chamber, true, finalLine), LOSS_COLOR)],
            components: gameComponents(gameId, true),
          });
          return;
        }

        player.safePulls += 1;
        await message.edit({
          embeds: [gameEmbed(
            `${icon("correct", "🍀")} Câmara vazia`,
            `${button.user} sobreviveu. Pode tentar de novo ou **Pipocar** para guardar o prêmio atual.\n\n` +
              buildDescription(players, chamber, false),
            DRAW_COLOR,
          )],
          components: gameComponents(gameId),
        });
      } catch (error) {
        logger.error("Falha durante partida de /roletarussa", error, { gameId, userId: button.user.id });
        if (!finished) {
          try { refundGameBets(gameId, context); } catch (refundError) {
            logger.error("Falha ao devolver apostas de /roletarussa", refundError, { gameId });
          }
          stakeReserved = false;
          finished = true;
          collector.stop("error");
          activeGames.releaseGame(gameId);
          await message.edit({
            embeds: [gameEmbed("Rodada cancelada", "O jogo foi cancelado e as apostas pendentes foram devolvidas.", LOSS_COLOR)],
            components: gameComponents(gameId, true),
          }).catch(() => undefined);
        }
        await button.followUp({ content: "A rodada foi cancelada. As apostas pendentes foram devolvidas.", flags: 64 }).catch(() => undefined);
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
      } catch (error) {
        logger.error("Falha ao devolver apostas após inatividade na /roletarussa", error, { gameId });
      }
      activeGames.releaseGame(gameId);
      void message.edit({
        embeds: [gameEmbed(
          "Rodada encerrada por inatividade",
          "A sessão expirou. Todas as apostas que ainda estavam reservadas foram devolvidas.",
          0x747f8d,
        )],
        components: gameComponents(gameId, true),
      }).catch((error: unknown) => logger.warn("Não consegui encerrar /roletarussa", { gameId, reason, error }));
    });
  } catch (error) {
    logger.error("Falha ao iniciar /roletarussa", error, { gameId, userId: owner.id });
    if (stakeReserved) {
      try { refundGameBets(gameId, context); } catch (refundError) {
        logger.error("Falha ao devolver aposta de /roletarussa", refundError, { gameId });
      }
    }
    activeGames.releaseGame(gameId);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        embeds: [gameEmbed("Rodada cancelada", "Não consegui iniciar a roleta. A aposta foi devolvida se chegou a ser reservada.", LOSS_COLOR)],
        components: [],
      }).catch(() => undefined);
    }
  } finally {
    if (!stakeReserved || finished) activeGames.releaseUser(owner.id, gameId);
  }
}

module.exports = defineCommand({
  category: "games",
  data: new SlashCommandBuilder()
    .setName("roletarussa")
    .setDescription("Jogue roleta-russa com outros membros e tente sair em segurança")
    .addIntegerOption((option) => option
      .setName("aposta")
      .setDescription("Aposta por participante (padrão: 500 cookies)")
      .setMinValue(1)
      .setMaxValue(1_000_000_000)
      .setRequired(false)),
  async execute(interaction: CommandChatInputInteraction): Promise<void> {
    await executeRussianRoulette(interaction);
  },
});
