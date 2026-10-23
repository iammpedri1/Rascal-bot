const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

const { canBet, settleDraw, settleDuel } = require("../utils/cookieEconomy");

const COOKIE_EMOJI = "\u{1F36A}";
const DRUM_EMOJI = "\u{1F389}";

const choices = {
  pedra: {
    label: "Pedra",
    emoji: "\uD83E\uDEA8",
    beats: "tesoura",
  },
  papel: {
    label: "Papel",
    emoji: "\uD83D\uDCC4",
    beats: "pedra",
  },
  tesoura: {
    label: "Tesoura",
    emoji: "\u2702\uFE0F",
    beats: "papel",
  },
};

const choiceIds = Object.keys(choices);

function randomChoice() {
  return choiceIds[Math.floor(Math.random() * choiceIds.length)];
}

function getWinner(choiceA, choiceB) {
  if (choiceA === choiceB) return "draw";
  return choices[choiceA].beats === choiceB ? "challenger" : "opponent";
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
      .setCustomId(`jokenpo|rematch|${challengerId}|${opponentId}|${amount}`)
      .setLabel("Revanche")
      .setEmoji("🔁")
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  category: "games",

  data: new SlashCommandBuilder()
    .setName("jokenpo")
    .setDescription("Desafie alguém em um Jokenpo aleatório valendo cookies")
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
    )
    .addIntegerOption(option =>
      option
        .setName("duracao")
        .setDescription("Tempo para aceitar o desafio")
        .setRequired(true)
        .addChoices(
          { name: "30 segundos", value: 30 },
          { name: "1 minuto", value: 60 },
          { name: "2 minutos", value: 120 },
          { name: "5 minutos", value: 300 }
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "Esse comando só pode ser usado em um servidor.",
        flags: 64,
      });
    }

    const opponent = interaction.options.getUser("usuario");
    const amount = interaction.options.getInteger("aposta");
    const duration = interaction.options.getInteger("duracao");
    const houseBot = isHouseBot(interaction, opponent);
    const houseId = interaction.client.user?.id;
    const economyContext = {
      guildId: interaction.guild.id,
      guildName: interaction.guild.name,
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
      const challengerChoice = randomChoice();
      const opponentChoice = randomChoice();
      const winner = getWinner(challengerChoice, opponentChoice);
      const challengerPlay = choices[challengerChoice];
      const opponentPlay = choices[opponentChoice];
      const resultLines = [];

      if (winner === "draw") {
        const { profileA, profileB } = settleDraw(interaction.user, opponent, economyContext);

        resultLines.push(
          `${DRUM_EMOJI} | \uD83E\uDD1D | <@${interaction.user.id}> escolheu ${challengerPlay.emoji}, <@${opponent.id}> escolheu ${opponentPlay.emoji}`,
          "Empate! Ninguém perdeu cookies.",
          "",
          `${COOKIE_EMOJI} | Aposta cancelada: **${amount.toLocaleString("pt-BR")} cookies**`,
          `\uD83D\uDCCA | <@${interaction.user.id}> saldo: ${COOKIE_EMOJI} **${balanceText(interaction.user, profileA, houseId)}**`,
          `\uD83D\uDCCA | <@${opponent.id}> saldo: ${COOKIE_EMOJI} **${balanceText(opponent, profileB, houseId)}**`
        );
      } else {
        const winnerUser = winner === "challenger" ? interaction.user : opponent;
        const loserUser = winner === "challenger" ? opponent : interaction.user;
        const winnerChoice = winner === "challenger" ? challengerPlay : opponentPlay;
        const loserChoice = winner === "challenger" ? opponentPlay : challengerPlay;
        const { winner: winnerProfile, loser: loserProfile } = settleDuel(winnerUser, loserUser, amount, economyContext);

        resultLines.push(
          `${DRUM_EMOJI} | \uD83C\uDF89 | <@${winnerUser.id}> escolheu ${winnerChoice.emoji}, <@${loserUser.id}> escolheu ${loserChoice.emoji}`,
          `Parabéns, <@${winnerUser.id}>, você ganhou!`,
          "",
          `\uD83C\uDFC6 | Vencedor: <@${winnerUser.id}>`,
          `${COOKIE_EMOJI} | Prêmio: **${amount.toLocaleString("pt-BR")} cookies**`,
          `\uD83D\uDCCA | <@${winnerUser.id}> saldo: ${COOKIE_EMOJI} **${balanceText(winnerUser, winnerProfile, houseId)}**`,
          `\uD83D\uDCCA | <@${loserUser.id}> saldo: ${COOKIE_EMOJI} **${balanceText(loserUser, loserProfile, houseId)}**`
        );
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(winner === "draw" ? 0xfaa61a : 0x57f287)
            .setTitle(`${DRUM_EMOJI} Resultado do Jokenpo`)
            .setDescription(
              [
                `\uD83E\uDEA8 \u2022 \uD83D\uDCC4 \u2022 \u2702\uFE0F`,
                `<@${interaction.user.id}>: ${challengerPlay.emoji} **${challengerPlay.label}**`,
                `<@${opponent.id}>: ${opponentPlay.emoji} **${opponentPlay.label}**`,
                "",
                ...resultLines,
              ].join("\n")
            ),
        ],
        components: [buildRematchRow(interaction.user.id, opponent.id, amount)],
      });
    }

    const endsAt = Math.floor((Date.now() + duration * 1000) / 1000);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`jkp_accept|${interaction.user.id}|${opponent.id}|${amount}`)
        .setLabel("Aceitar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`jkp_decline|${interaction.user.id}|${opponent.id}|${amount}`)
        .setLabel("Recusar")
        .setStyle(ButtonStyle.Danger)
    );

    const inviteEmbed = new EmbedBuilder()
      .setColor(0xfaa61a)
      .setTitle("Jokenpo")
      .setDescription(
        [
          `<@${interaction.user.id}> desafiou <@${opponent.id}>.`,
          `Aposta: ${COOKIE_EMOJI} **${amount} cookies**`,
          `Expira: <t:${endsAt}:R>`,
          "",
          "\uD83E\uDEA8 Pedra  \u2022  \uD83D\uDCC4 Papel  \u2022  \u2702\uFE0F Tesoura",
          `<@${opponent.id}>, aceite para o bot sortear as jogadas.`,
        ].join("\n")
      );

    await interaction.reply({
      content: `<@${opponent.id}>`,
      embeds: [inviteEmbed],
      components: [row],
    });
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: duration * 1000,
    });

    let finished = false;

    collector.on("collect", async buttonInteraction => {
      const [action, challengerId, opponentId, betValue] = buttonInteraction.customId.split("|");
      const bet = Number(betValue);

      if (buttonInteraction.user.id !== opponentId && buttonInteraction.user.id !== challengerId) {
        return buttonInteraction.reply({
          content: "Esse desafio pertence a outros jogadores.",
          flags: 64,
        });
      }

      if (buttonInteraction.user.id !== opponentId) {
        return buttonInteraction.reply({
          content: "Só quem foi desafiado pode aceitar ou recusar.",
          flags: 64,
        });
      }

      if (action === "jkp_decline") {
        finished = true;
        collector.stop("declined");

        return buttonInteraction.update({
          content: "",
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle("Jokenpo recusado")
              .setDescription(`<@${opponentId}> recusou a aposta de ${COOKIE_EMOJI} **${bet} cookies**.`),
          ],
          components: [],
        });
      }

      if (!canBet(interaction.user, bet) || !canBet(opponent, bet)) {
        finished = true;
        collector.stop("no_balance");

        return buttonInteraction.update({
          content: "",
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle("Aposta cancelada")
              .setDescription("Um dos jogadores não tem cookies suficientes para essa aposta."),
          ],
          components: [],
        });
      }

      const challengerChoice = randomChoice();
      const opponentChoice = randomChoice();
      const winner = getWinner(challengerChoice, opponentChoice);
      const challengerPlay = choices[challengerChoice];
      const opponentPlay = choices[opponentChoice];
      const resultLines = [];

      if (winner === "draw") {
        const { profileA, profileB } = settleDraw(interaction.user, opponent, economyContext);

        resultLines.push(
          `${DRUM_EMOJI} | \uD83E\uDD1D | <@${challengerId}> escolheu ${challengerPlay.emoji}, <@${opponentId}> escolheu ${opponentPlay.emoji}`,
          `Empate! Ninguém perdeu cookies.`,
          "",
          `${COOKIE_EMOJI} | Aposta cancelada: **${bet} cookies**`,
          `\uD83D\uDCCA | <@${challengerId}> saldo: ${COOKIE_EMOJI} **${balanceText(interaction.user, profileA, houseId)}**`,
          `\uD83D\uDCCA | <@${opponentId}> saldo: ${COOKIE_EMOJI} **${balanceText(opponent, profileB, houseId)}**`
        );
      } else {
        const winnerUser = winner === "challenger" ? interaction.user : opponent;
        const loserUser = winner === "challenger" ? opponent : interaction.user;
        const winnerChoice = winner === "challenger" ? challengerPlay : opponentPlay;
        const loserChoice = winner === "challenger" ? opponentPlay : challengerPlay;
        const { winner: winnerProfile, loser: loserProfile } = settleDuel(winnerUser, loserUser, bet, economyContext);

        resultLines.push(
          `${DRUM_EMOJI} | \uD83C\uDF89 | <@${winnerUser.id}> escolheu ${winnerChoice.emoji}, <@${loserUser.id}> escolheu ${loserChoice.emoji}`,
          `Parabéns, <@${winnerUser.id}>, você ganhou!`,
          "",
          `\uD83C\uDFC6 | Vencedor: <@${winnerUser.id}>`,
          `${COOKIE_EMOJI} | Prêmio: **${bet} cookies**`,
          `\uD83D\uDCCA | <@${winnerUser.id}> saldo: ${COOKIE_EMOJI} **${balanceText(winnerUser, winnerProfile, houseId)}**`,
          `\uD83D\uDCCA | <@${loserUser.id}> saldo: ${COOKIE_EMOJI} **${balanceText(loserUser, loserProfile, houseId)}**`
        );
      }

      finished = true;
      collector.stop("finished");

      return buttonInteraction.update({
        content: "",
        embeds: [
          new EmbedBuilder()
            .setColor(winner === "draw" ? 0xfaa61a : 0x57f287)
            .setTitle(`${DRUM_EMOJI} Resultado do Jokenpo`)
            .setDescription(
              [
                `\uD83E\uDEA8 \u2022 \uD83D\uDCC4 \u2022 \u2702\uFE0F`,
                `<@${challengerId}>: ${challengerPlay.emoji} **${challengerPlay.label}**`,
                `<@${opponentId}>: ${opponentPlay.emoji} **${opponentPlay.label}**`,
                "",
                ...resultLines,
              ].join("\n")
            ),
        ],
        components: [buildRematchRow(challengerId, opponentId, bet)],
      });
    });

    collector.on("end", () => {
      if (finished) return;

      message.edit({
        content: "",
        embeds: [
          new EmbedBuilder()
            .setColor(0x747f8d)
            .setTitle("Jokenpo expirado")
            .setDescription(`Tempo esgotado. A aposta de ${COOKIE_EMOJI} **${amount} cookies** foi cancelada.`),
        ],
        components: [],
      }).catch(() => {});
    });
  },

  async handleButton(interaction) {
    const [command, action, challengerId, opponentId, amountRaw] = interaction.customId.split("|");
    if (command !== "jokenpo" || action !== "rematch") return;

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
      getInteger: name => (name === "duracao" ? 60 : amount),
    };

    return module.exports.execute(rematchInteraction);
  },
};
