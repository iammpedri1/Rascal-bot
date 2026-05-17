const {
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");
const pkg = require("../package.json");

const ARTIST_EMOJI = process.env.ARTIST_EMOJI || "🎨";
const ARTIST_NAME = process.env.BOT_ARTIST || "leobrissxx";

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
    const createdTimestamp = Math.floor(botUser.createdAt.getTime() / 1000);
    const uptimeStr = formatUptime(process.uptime());
    const memory = process.memoryUsage();
    const memoryStr = `${(memory.rss / 1024 / 1024).toFixed(1)} MB`;
    const heapStr = `${(memory.heapUsed / 1024 / 1024).toFixed(1)} MB`;
    const nodeVersion = process.version.replace("v", "");
    const djsVersion = require("discord.js").version;
    const ping = client.ws.ping;
    const banner = botUser.bannerURL({ size: 2048, extension: "png" });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({
        name: `${botUser.username} - painel tecnico`,
        iconURL: botUser.displayAvatarURL({ size: 128 }),
      })
      .setThumbnail(botUser.displayAvatarURL({ size: 256 }))
      .setDescription(
        [
          `${emoji.devs} **Criador:** amillenium`,
          `${ARTIST_EMOJI} **Artista colaborador:** ${ARTIST_NAME}`,
          `${emoji.botFlag} **Versao:** ${codeLine(pkg.version)}`,
        ].join("\n")
      )
      .addFields(
        {
          name: "Runtime",
          value: [
            `${emoji.js} Node.js ${codeLine(nodeVersion)}`,
            `${emoji.work} Discord.js ${codeLine(djsVersion)}`,
            `${emoji.channel} Host ${codeLine(getHostLabel())}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Status",
          value: [
            `${emoji.online} Ping ${codeLine(`${ping}ms`)}`,
            `${emoji.clock} Online ${codeLine(uptimeStr)}`,
            `${emoji.clock} Criado <t:${createdTimestamp}:R>`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Memoria",
          value: [
            `RSS ${codeLine(memoryStr)}`,
            `Heap ${codeLine(heapStr)}`,
          ].join("\n"),
          inline: true,
        }
      )
      .setFooter({ text: interaction.guild?.name || "Discord bot" })
      .setTimestamp();

    if (banner) embed.setImage(banner);

    return interaction.editReply({ embeds: [embed] });
  },
};
