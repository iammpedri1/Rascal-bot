import { defineCommand } from "../types/command";

const { SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");
const { icon } = require("../utils/embedStyle");

function formatUptime(uptimeMs: number | null | undefined): string {
  let remaining = Math.floor(Math.max(0, uptimeMs ?? 0) / 1000);
  const units: Array<[number, string, string]> = [
    [30 * 86400, "mês", "meses"],
    [7 * 86400, "semana", "semanas"],
    [86400, "dia", "dias"],
    [3600, "hora", "horas"],
    [60, "minuto", "minutos"],
    [1, "segundo", "segundos"],
  ];
  const parts: string[] = [];
  for (const [seconds, singular, plural] of units) {
    const value = Math.floor(remaining / seconds);
    remaining %= seconds;
    if (value) parts.push(`${value} ${value === 1 ? singular : plural}`);
  }
  return parts.join(", ") || "0 segundos";
}

module.exports = defineCommand({
  category: "system",

  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Mostra a latência e o tempo ativo do bot"),

  async execute(interaction) {
    const startedAt = Date.now();
    await interaction.deferReply();
    const responseTime = Math.max(0, Date.now() - startedAt);
    const rawApiPing = Number(interaction.client.ws.ping);
    const apiPing = Number.isFinite(rawApiPing) && rawApiPing >= 0 ? Math.round(rawApiPing) : -1;
    const content = [
      `${icon("ping", "🏓")} ${interaction.user} pong! Yay!`,
      `${icon("clock", "🗓️")} **Uptime:** \`${formatUptime(interaction.client.uptime)}\``,
      `${icon("server", "🌐")} **API Ping:** ${apiPing >= 0 ? `${apiPing}ms` : "reconectando"}`,
      `${icon("botFlag", "💬")} **BOT Ping:** ${responseTime}ms`,
    ].join("\n");
    return interaction.editReply({ content, allowedMentions: { users: [interaction.user.id] } });
  },
});
