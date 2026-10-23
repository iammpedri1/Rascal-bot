const { SlashCommandBuilder } = require("discord.js");

function formatUptime(uptimeMs) {
  let remaining = Math.floor((uptimeMs ?? 0) / 1000);
  const units: Array<[number, string]> = [
    [86400, "dia"],
    [3600, "hora"],
    [60, "minuto"],
  ];
  const parts = [];

  for (const [seconds, label] of units) {
    const value = Math.floor(remaining / seconds);
    remaining %= seconds;
    if (value) parts.push(`${value} ${label}${value === 1 ? "" : "s"}`);
  }

  parts.push(`${remaining} segundo${remaining === 1 ? "" : "s"}`);
  return parts.join(", ");
}

function connectionStatus(apiPing, responseTime) {
  const highestPing = Math.max(apiPing, responseTime);
  if (highestPing < 150) return { label: "Excelente", color: 0x57f287 };
  if (highestPing < 350) return { label: "Estável", color: 0xfee75c };
  return { label: "Latência alta", color: 0xed4245 };
}

module.exports = {
  category: "system",

  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Mostra latência, uptime e estado da conexão"),

  async execute(interaction) {
    const client = interaction.client;

    await interaction.reply({ content: "Medindo a conexão..." });
    const response = await interaction.fetchReply();
    const responseTime = Math.max(0, response.createdTimestamp - interaction.createdTimestamp);
    const apiPing = Math.round(client.ws.ping);
    const status = connectionStatus(apiPing, responseTime);

    const statusIcon = status.label === "Excelente" ? "🟢" : status.label === "Estável" ? "🟡" : "🔴";
    return interaction.editReply({
      content: [
        `${client.user} ${statusIcon} **${status.label}**`,
        `> 🟣 **Uptime:** ${formatUptime(client.uptime)}`,
        `> 🔵 **API Ping:** ${apiPing >= 0 ? `${apiPing}ms` : "Reconectando…"}`,
        `> ⚪ **BOT Ping:** ${responseTime}ms`,
      ].join("\n"),
    });
  },
};
