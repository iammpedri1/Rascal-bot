const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const { canBet, settleDuel } = require("../utils/cookieEconomy");
const { getAnimeGif } = require("../utils/animeGifs");
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

function buildRematchRow(challengerId, opponentId, amount) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cara-ou-coroa|rematch|${challengerId}|${opponentId}|${amount}`)
      .setLabel("Revanche")
      .setEmoji("🔁")
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  category: "games",

  data: new SlashCommandBuilder()
    .setName("cara-ou-coroa")
    .setDescription("Aposte cookies em um cara ou coroa aleatório")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário que você quer desafiar")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("aposta")
        .setDescription("Quantidade de cookies para apostar")
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

    if (opponent.id === interaction.user.id) {
      return interaction.reply({
        content: "Você não pode desafiar você mesmo.",
        flags: 64,
      });
    }

    if (opponent.bot && !houseBot) {
      return interaction.reply({
        content: "Escolha uma pessoa ou aposte contra mim.",
        flags: 64,
      });
    }

    if (!canBet(interaction.user, amount)) {
      return interaction.reply({
        content: `Você não tem ${COOKIE_EMOJI} cookies suficientes para apostar ${amount}. Use /cookies saldo.`,
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
                `${interaction.user} ficou com **${challengerChoice}**.`,
                `${opponent} ficou com **${opponentChoice}**.`,
                "",
                "A moeda está no ar...",
              ].join("\n")
            ),
        ],
      });

      const message = await interaction.fetchReply();
      const { winner, loser } = settleDuel(winnerUser, loserUser, amount, economyContext);
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
                `🏆 <@${winnerUser.id}> venceu e ganhou ${COOKIE_EMOJI} **${amount.toLocaleString("pt-BR")} cookies**.`,
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
          `<@${interaction.user.id}> chamou <@${opponent.id}> para uma aposta.`,
          "",
              "Os lados serão sorteados quando o desafio for aceito.",
          "",
          `${COOKIE_EMOJI} **Aposta:** ${amount.toLocaleString("pt-BR")} cookies`,
          "",
          `<@${opponent.id}>, aceite ou recuse o desafio abaixo.`,
        ].join("\n")
      )
      .setThumbnail("https://cdn-icons-png.flaticon.com/512/272/272525.png")
      .setFooter({ text: "O vencedor leva a aposta do adversário." });

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
            content: "Só quem foi desafiado pode aceitar ou recusar.",
            flags: 64,
          });
        }

        if (action === "coin_decline") {
          finished = true;
          collector.stop("declined");

          return buttonInteraction.update({
            embeds: [
              new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle("Desafio recusado")
                .setDescription(`<@${opponentId}> recusou a aposta de ${COOKIE_EMOJI} **${bet} cookies**.`),
            ],
            components: [],
          });
        }

        if (!canBet(interaction.user, bet) || (!isHouseBot(interaction, opponent) && !canBet(opponent, bet))) {
          finished = true;
          collector.stop("no_balance");

          return buttonInteraction.update({
            content: "Um dos jogadores não tem cookies suficientes para essa aposta.",
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
                  `${interaction.user} ficou com **${challengerChoice}**.`,
                  `${opponent} ficou com **${opponentChoice}**.`,
                  "",
                  "A moeda está no ar...",
                ].join("\n")
              ),
          ],
          components: [],
        });

        const { winner, loser } = settleDuel(winnerUser, loserUser, bet, economyContext);
        const gif = await getAnimeGif("win");

        await wait(1800);

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(`${COIN_EMOJI} Resultado do Cara ou Coroa`)
          .setDescription(
            [
              `A moeda caiu em: **${coin.toUpperCase()}**`,
              "",
              `🏆 <@${winnerUser.id}> venceu e ganhou ${COOKIE_EMOJI} **${bet.toLocaleString("pt-BR")} cookies**.`,
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
          return message.edit(payload).catch(() => {});
        }

        return buttonInteraction.update(payload).catch(() => {});
      }
    });

    collector.on("end", () => {
      if (finished) return;

      message.edit({
        content: "Tempo esgotado. A aposta foi cancelada.",
        components: [],
      }).catch(() => {});
    });
  },

  async handleButton(interaction) {
    const [command, action, challengerId, opponentId, amountRaw] = interaction.customId.split("|");
    if (command !== "cara-ou-coroa" || action !== "rematch") return;

    if (![challengerId, opponentId].includes(interaction.user.id)) {
      return interaction.reply({
        content: "Essa revanche pertence a outros jogadores.",
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
};
