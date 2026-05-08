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

const COOKIE_EMOJI = "<a:cookiesemoji:1500946522118950943>";
const ACCEPT_EMOJI = "<:greentick:1500896913627549969>";
const DECLINE_EMOJI = "<:redtick:1500896911081603142>";
const COIN_EMOJI = "🪙";

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function flipCoin() {
  return Math.random() < 0.5 ? "cara" : "coroa";
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
    .setName("cara-ou-coroa")
    .setDescription("Aposte cookies em cara ou coroa")
    .addStringOption(option =>
      option
        .setName("escolha")
        .setDescription("Escolha o lado da moeda")
        .setRequired(true)
        .addChoices(
          { name: "Cara", value: "cara" },
          { name: "Coroa", value: "coroa" }
        )
    )
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
    ),

  async execute(interaction) {
    const choice = interaction.options.getString("escolha");
    const opponent = interaction.options.getUser("usuario");
    const amount = interaction.options.getInteger("aposta");
    const opponentChoice = choice === "cara" ? "coroa" : "cara";
    const economyContext = {
      guildId: interaction.guild?.id,
      guildName: interaction.guild?.name,
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

    if (!canBet(interaction.user, amount)) {
      return interaction.reply({
        content: `Voce nao tem ${COOKIE_EMOJI} cookies suficientes para apostar ${amount}. Use /cookies saldo.`,
        flags: 64,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`coin_accept|${interaction.user.id}|${opponent.id}|${amount}`)
        .setLabel("Aceitar")
        .setEmoji(parseEmoji(ACCEPT_EMOJI))
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`coin_decline|${interaction.user.id}|${opponent.id}|${amount}`)
        .setLabel("Recusar")
        .setEmoji(parseEmoji(DECLINE_EMOJI))
        .setStyle(ButtonStyle.Danger)
    );

    const inviteEmbed = new EmbedBuilder()
      .setColor(0xfaa61a)
      .setTitle(`${COIN_EMOJI} Cara ou Coroa`)
      .setDescription(
        [
          `<@${interaction.user.id}> chamou <@${opponent.id}> para uma aposta.`,
          "",
          `**${interaction.user.username}** escolheu: **${choice.toUpperCase()}**`,
          `**${opponent.username}** ficará com: **${opponentChoice.toUpperCase()}**`,
          "",
          `${COOKIE_EMOJI} **Aposta:** ${amount.toLocaleString("pt-BR")} cookies`,
          "",
          `<@${opponent.id}>, aceite ou recuse o desafio abaixo.`,
        ].join("\n")
      )
      .setThumbnail("https://cdn-icons-png.flaticon.com/512/272/272525.png")
      .setFooter({ text: "O vencedor leva a aposta do adversário." });

    const message = await interaction.reply({
      embeds: [inviteEmbed],
      components: [row],
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    let finished = false;

    collector.on("collect", async buttonInteraction => {
      const [action, challengerId, opponentId, betValue] = buttonInteraction.customId.split("|");
      const bet = Number(betValue);

      if (buttonInteraction.user.id !== opponentId) {
        return buttonInteraction.reply({
          content: "So quem foi desafiado pode aceitar ou recusar.",
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

      if (!canBet(interaction.user, bet) || !canBet(opponent, bet)) {
        finished = true;
        collector.stop("no_balance");

        return buttonInteraction.update({
          content: "Um dos jogadores nao tem cookies suficientes para essa aposta.",
          embeds: [],
          components: [],
        });
      }

      const coin = flipCoin();
      const challengerWon = choice === coin;
      const winnerUser = challengerWon ? interaction.user : opponent;
      const loserUser = challengerWon ? opponent : interaction.user;
      const { winner, loser } = settleDuel(winnerUser, loserUser, bet, economyContext);
      const gif = await getAnimeGif("win");

      finished = true;
      collector.stop("finished");

      await buttonInteraction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0xfaa61a)
            .setTitle(`${COIN_EMOJI} Girando a moeda...`)
            .setDescription(
              [
                `${interaction.user} escolheu **${choice}**.`,
                `${opponent} ficou com **${opponentChoice}**.`,
                "",
                "A moeda está no ar...",
              ].join("\n")
            ),
        ],
        components: [],
      });

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
            `<@${challengerId}>: **${choice.toUpperCase()}**`,
            `<@${opponentId}>: **${opponentChoice.toUpperCase()}**`,
            "",
            `**Saldos**`,
            `<@${winnerUser.id}>: **${winner.balance.toLocaleString("pt-BR")}**`,
            `<@${loserUser.id}>: **${loser.balance.toLocaleString("pt-BR")}**`,
          ].join("\n")
        )
        .setImage(gif);

      return message.edit({
        embeds: [embed],
        components: [],
      });
    });

    collector.on("end", () => {
      if (finished) return;

      message.edit({
        content: "Tempo esgotado. A aposta foi cancelada.",
        components: [],
      }).catch(() => {});
    });
  },
};
