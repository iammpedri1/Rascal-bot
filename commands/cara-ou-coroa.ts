import { defineCommand } from "../types/command";
import { randomUUID } from "node:crypto";
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js") as typeof import("discord.js");

const { reserveStakes, resolveGame, refundGameBets } = require("../utils/gameEconomy");
const { getAnimeGif } = require("../utils/animeGifs");
const emoji = require("../utils/emojis");
const logger = require("../utils/logger");

const COOKIE_EMOJI = "\u{1F36A}";
const COIN_EMOJI = "🪙";

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function flipCoin() {
  return Math.random() < 0.5 ? "cara" : "coroa";
}

function randomSides() {
  const challengerChoice = flipCoin();
  const opponentChoice = challengerChoice === "cara" ? "coroa" : "cara";

  return {
    challengerChoice,
    opponentChoice,
  };
}

function isHouseBot(interaction, user) {
  return user?.bot && user.id === interaction.client.user?.id;
}

function balanceText(user, profile, houseId) {
  return user.id === houseId ? "infinito" : profile.balance.toLocaleString("pt-BR");
}

function buildRematchRow(challengerId, opponentId, amount): import("discord.js").ActionRowBuilder<import("discord.js").ButtonBuilder> {
  return new ActionRowBuilder<import("discord.js").ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`cara-ou-coroa|rematch|${challengerId}|${opponentId}|${amount}`)
      .setLabel("Revanche")
      .setEmoji(emoji.toComponentEmoji("🔁"))
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = defineCommand({
  category: "games",

  data: new SlashCommandBuilder()
    .setName("cara-ou-coroa")
    .setDescription("Realize apostas de cookies no clássico Cara ou Coroa")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário que deseja desafiar")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("aposta")
        .setDescription("Quantidade de cookies para aposta")
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const opponent = interaction.options.getUser("usuario");
    const amount = interaction.options.getInteger("aposta");
    const houseBot = isHouseBot(interaction, opponent);
    const houseId = interaction.client.user?.id;
    const economyContext = {
      guildId: interaction.guild?.id,
      guildName: interaction.guild?.name,
    };
    const gameId = `coin-${randomUUID()}`;

    if (opponent.id === interaction.user.id) {
      return interaction.reply({
        content: "Não é possível desafiar a si próprio.",
        flags: 64,
      });
    }

    if (opponent.bot && !houseBot) {
      return interaction.reply({
        content: "Por favor, desafie um membro ou aposte contra o Rascal.",
        flags: 64,
      });
    }

    const reservation = reserveStakes(gameId, [{
      userId: interaction.user.id,
      username: interaction.user.username,
      amount,
    }], economyContext);
    if (!reservation.ok) {
      return interaction.reply({
        content: `Saldo insuficiente. Você não possui ${COOKIE_EMOJI} **${amount.toLocaleString("pt-BR")} cookies** para esta aposta. Verifique seu saldo com \`/cookies saldo\`.`,
        flags: 64,
      });
    }

    if (houseBot) {
      const { challengerChoice, opponentChoice } = randomSides();
      const coin = flipCoin();
      const challengerWon = challengerChoice === coin;
      const winnerUser = challengerWon ? interaction.user : opponent;
      const loserUser = challengerWon ? opponent : interaction.user;

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xfaa61a)
            .setTitle(`${COIN_EMOJI} Girando a moeda...`)
            .setDescription(
              [
                `${interaction.user} escolheu **${challengerChoice}**.`,
                `${opponent} ficou com **${opponentChoice}**.`,
                "",
                "A moeda foi lançada...",
              ].join("\n")
            ),
        ],
      });

      const message = await interaction.fetchReply();
      const [winnerBalance] = resolveGame(gameId, [{
        userId: interaction.user.id,
        username: interaction.user.username,
        outcome: challengerWon ? "win" : "loss",
        payout: challengerWon ? amount * 2 : 0,
        note: "Cara ou coroa contra a casa",
      }], economyContext);
      const winner = challengerWon ? winnerBalance : { balance: 0 };
      const loser = challengerWon ? { balance: 0 } : winnerBalance;
      const gif = await getAnimeGif("win");

      await wait(1800);

      return message.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle(`${COIN_EMOJI} Resultado do Cara ou Coroa`)
            .setDescription(
              [
                `A moeda caiu em: **${coin.toUpperCase()}**`,
                "",
                `🏆 <@${winnerUser.id}> venceu o desafio e obteve ${COOKIE_EMOJI} **${amount.toLocaleString("pt-BR")} cookies**.`,
                "",
                `**Placar**`,
                `<@${interaction.user.id}>: **${challengerChoice.toUpperCase()}**`,
                `<@${opponent.id}>: **${opponentChoice.toUpperCase()}**`,
                "",
                `**Saldos**`,
                `<@${winnerUser.id}>: **${balanceText(winnerUser, winner, houseId)}**`,
                `<@${loserUser.id}>: **${balanceText(loserUser, loser, houseId)}**`,
              ].join("\n")
            )
            .setImage(gif),
        ],
        components: [buildRematchRow(interaction.user.id, opponent.id, amount)],
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`coin_accept|${interaction.user.id}|${opponent.id}|${amount}`)
        .setLabel("Aceitar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`coin_decline|${interaction.user.id}|${opponent.id}|${amount}`)
        .setLabel("Recusar")
        .setStyle(ButtonStyle.Danger)
    );

    const inviteEmbed = new EmbedBuilder()
      .setColor(0xfaa61a)
      .setTitle(`${COIN_EMOJI} Cara ou Coroa`)
      .setDescription(
        [
          `<@${interaction.user.id}> desafiou <@${opponent.id}> para uma aposta.`,
          "",
          "A escolha dos lados ocorrerá após a aceitação do desafio.",
          "",
          `${COOKIE_EMOJI} **Aposta:** ${amount.toLocaleString("pt-BR")} cookies`,
          "",
          `<@${opponent.id}>, aceite ou recuse o desafio abaixo.`,
        ].join("\n")
      )
      .setThumbnail("https://cdn-icons-png.flaticon.com/512/272/272525.png")
      .setFooter({ text: "O vencedor receberá o montante total da aposta." });

    await interaction.reply({
      embeds: [inviteEmbed],
      components: [row],
    });
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    let finished = false;

    collector.on("collect", async buttonInteraction => {
      try {
        const [action, challengerId, opponentId, betValue] = buttonInteraction.customId.split("|");
        const bet = Number(betValue);

        if (buttonInteraction.user.id !== opponentId) {
          return buttonInteraction.reply({
            content: "Apenas o usuário desafiado tem permissão para interagir.",
            flags: 64,
          });
        }

        if (action === "coin_decline") {
          finished = true;
          collector.stop("declined");

          refundGameBets(gameId, economyContext);
          return buttonInteraction.update({
            embeds: [
              new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle("Desafio recusado")
                .setDescription(`<@${opponentId}> recusou a aposta de ${COOKIE_EMOJI} **${bet.toLocaleString("pt-BR")} cookies**.`),
            ],
            components: [],
          });
        }

        const opponentReservation = isHouseBot(interaction, opponent)
          ? { ok: true }
          : reserveStakes(gameId, [{
            userId: opponent.id,
            username: opponent.username,
            amount: bet,
          }], economyContext);
        if (!opponentReservation.ok) {
          finished = true;
          collector.stop("no_balance");
          refundGameBets(gameId, economyContext);

          return buttonInteraction.update({
            content: "Saldo insuficiente para um dos participantes. A aposta não pode ser concluída.",
            embeds: [],
            components: [],
          });
        }

        const { challengerChoice, opponentChoice } = randomSides();
        const coin = flipCoin();
        const challengerWon = challengerChoice === coin;
        const winnerUser = challengerWon ? interaction.user : opponent;
        const loserUser = challengerWon ? opponent : interaction.user;

        finished = true;
        collector.stop("finished");

        await buttonInteraction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0xfaa61a)
              .setTitle(`${COIN_EMOJI} Girando a moeda...`)
              .setDescription(
                [
                  `${interaction.user} escolheu **${challengerChoice}**.`,
                  `${opponent} ficou com **${opponentChoice}**.`,
                  "",
                  "A moeda foi lançada...",
                ].join("\n")
              ),
          ],
          components: [],
        });

        const balances = resolveGame(gameId, isHouseBot(interaction, opponent)
          ? [{
            userId: interaction.user.id,
            username: interaction.user.username,
            outcome: challengerWon ? "win" : "loss",
            payout: challengerWon ? bet * 2 : 0,
            note: "Cara ou coroa contra a casa",
          }]
          : [
            {
              userId: interaction.user.id,
              username: interaction.user.username,
              outcome: challengerWon ? "win" : "loss",
              payout: challengerWon ? bet * 2 : 0,
              note: "Cara ou coroa",
            },
            {
              userId: opponent.id,
              username: opponent.username,
              outcome: challengerWon ? "loss" : "win",
              payout: challengerWon ? 0 : bet * 2,
              note: "Cara ou coroa",
            },
          ], economyContext);
        const winner = balances.find(result => result.userId === winnerUser.id) ?? { balance: 0 };
        const loser = balances.find(result => result.userId === loserUser.id) ?? { balance: 0 };
        const gif = await getAnimeGif("win");

        await wait(1800);

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(`${COIN_EMOJI} Resultado do Cara ou Coroa`)
          .setDescription(
            [
              `A moeda caiu em: **${coin.toUpperCase()}**`,
              "",
              `🏆 <@${winnerUser.id}> venceu o desafio e obteve ${COOKIE_EMOJI} **${bet.toLocaleString("pt-BR")} cookies**.`,
              "",
              `**Placar**`,
              `<@${challengerId}>: **${challengerChoice.toUpperCase()}**`,
              `<@${opponentId}>: **${opponentChoice.toUpperCase()}**`,
              "",
              `**Saldos**`,
              `<@${winnerUser.id}>: **${balanceText(winnerUser, winner, houseId)}**`,
              `<@${loserUser.id}>: **${balanceText(loserUser, loser, houseId)}**`,
            ].join("\n")
          )
          .setImage(gif);

        return message.edit({
          embeds: [embed],
          components: [buildRematchRow(challengerId, opponentId, bet)],
        });
      } catch (error) {
        finished = true;
        collector.stop("error");
        logger.error("Erro ao processar aceite do /cara-ou-coroa", error, {
          user: buttonInteraction.user.id,
          guild: buttonInteraction.guildId,
        });

        const payload = {
          content: "Não consegui finalizar essa aposta. Tente novamente em alguns instantes.",
          embeds: [],
          components: [],
        };

        if (buttonInteraction.deferred || buttonInteraction.replied) {
          return message.edit(payload).catch(() => { });
        }

        return buttonInteraction.update(payload).catch(() => { });
      }
    });

    collector.on("end", () => {
      if (finished) return;
      try {
        refundGameBets(gameId, economyContext);
      } catch (error) {
        logger.error("Falha ao estornar aposta expirada do /cara-ou-coroa", error, { gameId });
      }

      message.edit({
        content: "O tempo limite expirou. O desafio foi cancelada automaticamente.",
        components: [],
      }).catch(() => { });
    });
  },

  async handleButton(interaction) {
    const [command, action, challengerId, opponentId, amountRaw] = interaction.customId.split("|");
    if (command !== "cara-ou-coroa" || action !== "rematch") return;

    if (![challengerId, opponentId].includes(interaction.user.id)) {
      return interaction.reply({
        content: "Esta solicitação de revanche é restrita aos participantes originais.",
        flags: 64,
      });
    }

    const nextOpponentId = interaction.user.id === challengerId ? opponentId : challengerId;
    const opponent = await interaction.client.users.fetch(nextOpponentId).catch(() => null);
    const amount = Number(amountRaw);

    if (!opponent || !Number.isFinite(amount) || amount < 1) {
      return interaction.reply({
        content: "Não consegui iniciar a revanche.",
        flags: 64,
      });
    }

    const rematchInteraction = Object.create(interaction);
    rematchInteraction.options = {
      getUser: () => opponent,
      getInteger: () => amount,
    };

    return module.exports.execute(rematchInteraction);
  },
});
