const { SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");

function formatUptime(uptimeMs) {
  const secondsTotal = Math.floor((uptimeMs ?? 0) / 1000);
  const days = Math.floor(secondsTotal / 86400);
  const hours = Math.floor((secondsTotal % 86400) / 3600);
  const minutes = Math.floor((secondsTotal % 3600) / 60);
  const seconds = secondsTotal % 60;
  const parts = [];

  if (days) parts.push(`${days} dia${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hora${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minuto${minutes === 1 ? "" : "s"}`);
  parts.push(`${seconds} segundo${seconds === 1 ? "" : "s"}`);

  return parts.join(", ");
}

module.exports = {
  category: "system",

  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Mostra a latência do bot"),

  async execute(interaction) {
    const client = interaction.client;

    await interaction.reply({
      content: `${emoji.clock} Calculando ping...`,
    });

    const sent = await interaction.fetchReply();
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiPing = Math.round(client.ws.ping);

    await interaction.editReply({
      content: [
        `${emoji.correct} **Pong!**`,
        `${emoji.clock} **Online há:** ${formatUptime(client.uptime)}`,
        `${emoji.online} **Ping da API:** \`${apiPing}ms\``,
        `${emoji.pandaCientista} **Ping do bot:** \`${latency}ms\``,
      ].join("\n"),
    });
  },
};
