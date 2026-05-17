const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");

const COOKIE_COLOR = 0xf5a623;

function bullet(icon, text) {
  return `${icon} ${text}`;
}

function buildCookiesEmbed(interaction) {
  return new EmbedBuilder()
    .setColor(COOKIE_COLOR)
    .setAuthor({
      name: `${interaction.client.user.username} - Guia de cookies`,
      iconURL: interaction.client.user.displayAvatarURL({ size: 128 }),
    })
    .setTitle(`${emoji.cookie} Como funcionam os cookies?`)
    .setDescription(
      [
        "Cookies são a economia do servidor. Você ganha participando, jogando e usando os comandos de recompensa.",
        "",
        `${emoji.gift} **Prêmios semanais:** top 1 recebe **15.000**, top 2 recebe **10.000** e top 3 recebe **5.000** cookies nos rankings de mensagens e voz.`,
      ].join("\n")
    )
    .addFields(
      {
        name: `${emoji.correct} Como ganhar cookies`,
        value: [
          bullet(emoji.lorittaMegafone, "Conversando no chat e acumulando XP."),
          bullet(emoji.voice, "Participando dos canais de voz para subir no `/rankvoz`."),
          bullet(emoji.clap, "Aparecendo no `/rankmensagens` semanal."),
          bullet(emoji.work, "Usando `/trabalhar` quando o cooldown acabar."),
          bullet(emoji.gift, "Resgatando `/daily` e `/bonus`."),
          bullet(emoji.gamesIcon, "Participando de apostas e minigames como `/jokenpo`, `/cara-ou-coroa` e `/rifa`."),
          bullet(emoji.police, "Tentando roubar alguém com `/roubar usuario` quando quiser arriscar."),
        ].join("\n"),
        inline: false,
      },
      {
        name: `${emoji.shop} Como gastar ou mover cookies`,
        value: [
          bullet(emoji.cookie, "Apostando em jogos e desafios."),
          bullet(emoji.lorittaCafune, "Pagando outros membros com `/cookies pagar`."),
          bullet(emoji.ticket, "Entrando em eventos, sorteios ou sistemas especiais do servidor quando a equipe abrir."),
          bullet(emoji.thinking, "Arriscando em comandos que podem dar lucro ou prejuízo, como `/roubar` e `/trabalhar`."),
        ].join("\n"),
        inline: false,
      },
      {
        name: `${emoji.menuIcon} Comandos úteis`,
        value: [
          "`/cookies saldo` - vê seu saldo e estatísticas.",
          "`/inventario` - mostra seu inventário de cookies.",
          "`/rank cookies` - ranking global de cookies.",
          "`/rankmensagens` - ranking semanal de mensagens.",
          "`/rankvoz` - ranking semanal de voz.",
          "`/lembretes` - vê seus cooldowns importantes.",
        ].join("\n"),
        inline: false,
      }
    )
    .setFooter({ text: "Os prêmios semanais são pagos uma única vez por semana para cada ranking." })
    .setTimestamp();
}

module.exports = {
  category: "info",

  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("Mostra guias e informações do servidor")
    .addSubcommand(subcommand =>
      subcommand
        .setName("cookies")
        .setDescription("Explica como ganhar, gastar e acompanhar cookies")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "cookies") {
      return interaction.reply({
        embeds: [buildCookiesEmbed(interaction)],
      });
    }

    return interaction.reply({
      content: `${emoji.crossed} Subcomando desconhecido.`,
      flags: 64,
    });
  },
};
