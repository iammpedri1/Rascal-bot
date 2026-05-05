const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ChannelType,
} = require("discord.js");

const { canBet, settleDraw, settleDuel } = require("../utils/cookieEconomy");
const emoji = require("../utils/emojis");

const COOKIE_EMOJI = emoji.cookie;
const ACCEPT_EMOJI = "<:greentick:1500896913627549969>";
const DECLINE_EMOJI = "<:redtick:1500896911081603142>";
const DRUM_EMOJI = emoji.party;

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

function parseEmoji(emoji) {
  const match = emoji?.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
  if (!match) return emoji;

  return {
    name: match[1],
    id: match[2],
    animated: emoji.startsWith("<a:"),
  };
}

module.exports = {
  category: "games",

  data: new SlashCommandBuilder()
    .setName("jokenpo")
    .setDescription("Desafie alguem em um Jokenpo aleatorio valendo cookies")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuario que voce quer desafiar")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("aposta")
        .setDescription("Quantidade de cookies para apostar")
        .setRequired(true)
        .setMinValue(1)
    )
    .addChannelOption(option =>
      option
        .setName("canal")
        .setDescription("Canal onde o desafio sera enviado")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
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
        content: "Esse comando so pode ser usado em um servidor.",
        flags: 64,
      });
    }

    const opponent = interaction.options.getUser("usuario");
    const amount = interaction.options.getInteger("aposta");
    const channel = interaction.options.getChannel("canal");
    const duration = interaction.options.getInteger("duracao");
    const economyContext = {
      guildId: interaction.guild.id,
      guildName: interaction.guild.name,
    };

    if (opponent.id === interaction.user.id) {
      return interaction.reply({
        content: "Voce nao pode desafiar voce mesmo.",
        flags: 64,
      });
    }

    if (opponent.bot) {
      return interaction.reply({
        content: "Escolha uma pessoa para jogar, nao um bot.",
        flags: 64,
      });
    }

    if (!channel?.isTextBased()) {
      return interaction.reply({
        content: "Escolha um canal de texto valido para enviar o desafio.",
        flags: 64,
      });
    }

    if (!canBet(interaction.user, amount)) {
      return interaction.reply({
        content: `Voce nao tem ${COOKIE_EMOJI} cookies suficientes para apostar ${amount}. Use /cookies saldo.`,
        flags: 64,
      });
    }

    const endsAt = Math.floor((Date.now() + duration * 1000) / 1000);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`jkp_accept|${interaction.user.id}|${opponent.id}|${amount}`)
        .setLabel("Aceitar")
        .setEmoji(parseEmoji(ACCEPT_EMOJI))
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`jkp_decline|${interaction.user.id}|${opponent.id}|${amount}`)
        .setLabel("Recusar")
        .setEmoji(parseEmoji(DECLINE_EMOJI))
        .setStyle(ButtonStyle.Danger)
    );

    const inviteEmbed = new EmbedBuilder()
      .setColor(0xfaa61a)
      .setTitle("Jokenpo")
      .setDescription(
        [
          `${emoji.clap} <@${interaction.user.id}> desafiou <@${opponent.id}>.`,
          `Aposta: ${COOKIE_EMOJI} **${amount} cookies**`,
          `${emoji.clock} Expira: <t:${endsAt}:R>`,
          "",
          "\uD83E\uDEA8 Pedra  \u2022  \uD83D\uDCC4 Papel  \u2022  \u2702\uFE0F Tesoura",
          `<@${opponent.id}>, aceite para o bot sortear as jogadas.`,
        ].join("\n")
      );

    await interaction.deferReply({ flags: 64 });

    let message;

    try {
      message = await channel.send({
        content: `<@${opponent.id}>`,
        embeds: [inviteEmbed],
        components: [row],
      });
    } catch {
      return interaction.editReply({
        content: "Nao consegui enviar o desafio nesse canal. Veja se tenho permissao para enviar mensagens la.",
      });
    }

    await interaction.editReply({
      content: `Desafio de Jokenpo enviado em ${channel}.`,
    });

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
          content: "So quem foi desafiado pode aceitar ou recusar.",
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
              .setTitle(`${emoji.sad} Jokenpo recusado`)
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
              .setTitle(`${emoji.sad} Aposta cancelada`)
              .setDescription("Um dos jogadores nao tem cookies suficientes para essa aposta."),
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
          `${emoji.sad} | Deu empate! Ninguem perdeu cookies.`,
          "",
          `${COOKIE_EMOJI} | Aposta cancelada: **${bet} cookies**`,
          `\uD83D\uDCCA | <@${challengerId}> saldo: ${COOKIE_EMOJI} **${profileA.balance}**`,
          `\uD83D\uDCCA | <@${opponentId}> saldo: ${COOKIE_EMOJI} **${profileB.balance}**`
        );
      } else {
        const winnerUser = winner === "challenger" ? interaction.user : opponent;
        const loserUser = winner === "challenger" ? opponent : interaction.user;
        const winnerChoice = winner === "challenger" ? challengerPlay : opponentPlay;
        const loserChoice = winner === "challenger" ? opponentPlay : challengerPlay;
        const { winner: winnerProfile, loser: loserProfile } = settleDuel(winnerUser, loserUser, bet, economyContext);

        resultLines.push(
          `${DRUM_EMOJI} | \uD83C\uDF89 | <@${winnerUser.id}> escolheu ${winnerChoice.emoji}, <@${loserUser.id}> escolheu ${loserChoice.emoji}`,
          `${emoji.clap} | Parabens, <@${winnerUser.id}>, voce ganhou!`,
          "",
          `\uD83C\uDFC6 | Vencedor: <@${winnerUser.id}>`,
          `${COOKIE_EMOJI} | Premio: **${bet} cookies**`,
          `\uD83D\uDCCA | <@${winnerUser.id}> saldo: ${COOKIE_EMOJI} **${winnerProfile.balance}**`,
          `\uD83D\uDCCA | <@${loserUser.id}> saldo: ${COOKIE_EMOJI} **${loserProfile.balance}**`
        );
      }

      finished = true;
      collector.stop("finished");

      return buttonInteraction.update({
        content: "",
        embeds: [
          new EmbedBuilder()
            .setColor(winner === "draw" ? 0xfaa61a : 0x57f287)
            .setTitle(`${emoji.party} Resultado do Jokenpo`)
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
        components: [],
      });
    });

    collector.on("end", () => {
      if (finished) return;

      message.edit({
        content: "",
        embeds: [
          new EmbedBuilder()
            .setColor(0x747f8d)
            .setTitle(`${emoji.clock} Jokenpo expirado`)
            .setDescription(`Tempo esgotado. A aposta de ${COOKIE_EMOJI} **${amount} cookies** foi cancelada.`),
        ],
        components: [],
      }).catch(() => {});
    });
  },
};
