const {
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js");
const path = require("path");

const emoji = require("../utils/emojis");
const pkg = require(path.join(process.cwd(), "package.json"));

const ARTIST_EMOJI = process.env.ARTIST_EMOJI || "🎨";
const CREATOR_NAME = process.env.BOT_CREATOR || "amillenium";
const ARTIST_NAME = process.env.BOT_ARTIST || "leobrissxx";
const HONORABLE_MENTION = process.env.BOT_HONORABLE_MENTION || "Rascal Team";

function formatUptime(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor(totalSeconds / 60) % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function codeLine(value) {
  return `\`${String(value).replace(/`/g, "'")}\``;
}

function getHostLabel() {
  if (process.env.SERVICE_HOST === "node-windows") return "node-windows";
  return "Node.js local";
}

function formatCreatedAt(timestamp) {
  return new Date(timestamp).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

module.exports = {
  category: "info",

  data: new SlashCommandBuilder()
    .setName("bot")
    .setDescription("Comandos de informacoes do bot")
    .addSubcommand(subcommand =>
      subcommand
        .setName("info")
        .setDescription("Mostra informacoes tecnicas do bot")
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const client = interaction.client;
    const botUser = await client.user.fetch({ force: true });
    const createdTimestamp = Math.floor(botUser.createdTimestamp / 1000);
    const uptimeSeconds = Math.floor((client.uptime ?? process.uptime() * 1000) / 1000);
    const uptimeStr = formatUptime(uptimeSeconds);
    const ping = client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(0xff8a3d)
      .setThumbnail(botUser.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: `${emoji.devs} Criadores`,
          value: `**${CREATOR_NAME}**`,
          inline: true,
        },
        {
          name: `${emoji.js} Linguagem`,
          value: "**JavaScript & Node.js**",
          inline: true,
        },
        {
          name: `${ARTIST_EMOJI} Designer`,
          value: `**${ARTIST_NAME}**`,
          inline: true,
        },
        {
          name: `${emoji.clock} Ontime`,
          value: codeLine(uptimeStr),
          inline: true,
        },
        {
          name: `${emoji.settingsIcon} Versão`,
          value: codeLine(pkg.version),
          inline: true,
        },
        {
          name: `${emoji.online} Host`,
          value: codeLine(getHostLabel()),
          inline: true,
        },
        {
          name: `${emoji.botFlag} Ping`,
          value: codeLine(ping >= 0 ? `${Math.round(ping)} ms` : "Reconectando…"),
          inline: true,
        },
        {
          name: `${emoji.calendar} Criado em`,
          value: codeLine(formatCreatedAt(botUser.createdTimestamp)),
          inline: true,
        },
        {
          name: `${emoji.owner} Menção Honrosa`,
          value: `**${HONORABLE_MENTION}**`,
          inline: true,
        }
      )
      .setFooter({ text: "Copyright © 2022 Discord Network. All Rights Reserved." });

    return interaction.editReply({ embeds: [embed] });
  },
};
