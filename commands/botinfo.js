const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");
const pkg = require("../package.json");

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
  if (process.env.RUNNING_IN_DOCKER === "true") return "Docker";
  if (process.env.SERVICE_HOST === "node-windows") return "node-windows";
  return "Node.js Local";
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
    const memoryStr = `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`;
    const nodeVersion = process.version.replace("v", "");
    const djsVersion = require("discord.js").version;
    const ping = client.ws.ping;
    const host = getHostLabel();

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(`${emoji.botFlag} INFORMACOES DO BOT`)
      .setThumbnail(botUser.displayAvatarURL({ size: 256 }))
      .setDescription(
        [
          `${emoji.devs} \u00bb **Criador:** amillenium`,
          `${emoji.js} \u00bb **Linguagem:** JavaScript & Node.js ${codeLine(nodeVersion)}`,
          `${emoji.clock} \u00bb **Online:** ${codeLine(uptimeStr)}`,
          `${emoji.online} \u00bb **Ping:** ${codeLine(`${ping}ms`)}`,
          `${emoji.channel} \u00bb **Host:** ${codeLine(host)}`,
          `${emoji.botFlag} \u00bb **Versao:** ${codeLine(pkg.version)}`,
          "",
          `${emoji.work} \u00bb **Runtime:** Discord.js ${codeLine(djsVersion)} \u2022 RAM ${codeLine(memoryStr)}`,
          `${emoji.clock} \u00bb **Criado em:** <t:${createdTimestamp}:d> \u2022 <t:${createdTimestamp}:R>`,
        ].join("\n")
      );

    return interaction.editReply({ embeds: [embed] });
  },
};
