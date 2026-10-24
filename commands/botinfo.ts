import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { CommandChatInputInteraction } from "../types/command";
import { defineCommand } from "../types/command";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface PackageMetadata {
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface EmojiCatalog {
  application(name: string, fallback?: string): string;
  clock: string;
  online: string;
  calendar: string;
  server: string;
  ping: string;
}

const emoji = require("../utils/emojis") as EmojiCatalog;
const { randomColor } = require("../utils/embedStyle") as { randomColor: () => number };
const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as PackageMetadata;
const CREATOR_NAME = process.env.BOT_CREATOR || "amillenium";
const ARTIST_NAME = process.env.BOT_ARTIST || "leobrissxx";

function cleanVersion(value: string | undefined, fallback: string): string {
  return String(value || fallback).replace(/^[^\d]*/, "");
}

function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor(totalSeconds / 3_600) % 24;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const parts = [days ? `${days}d` : "", hours ? `${hours}h` : "", `${minutes}m`].filter(Boolean);
  return parts.join(" ");
}

function getHostLabel(): string {
  if (process.env.SERVICE_HOST) return process.env.SERVICE_HOST;
  return process.platform === "linux" ? "Linux · local" : `Node.js · ${process.platform}`;
}

module.exports = defineCommand({
  category: "info",
  data: new SlashCommandBuilder()
    .setName("bot")
    .setDescription("Comandos de informações do bot")
    .addSubcommand(subcommand => subcommand
      .setName("info")
      .setDescription("Mostra informações técnicas do bot")),

  async execute(interaction: CommandChatInputInteraction) {
    await interaction.deferReply();
    const botUser = interaction.client.user;
    if (!botUser) return interaction.editReply({ content: "As informações do bot ainda não estão disponíveis." });

    const uptimeSeconds = Math.floor((interaction.client.uptime ?? process.uptime() * 1000) / 1000);
    const ping = interaction.client.ws.ping;
    const createdAt = Math.floor(botUser.createdTimestamp / 1000);
    const typescriptVersion = cleanVersion(pkg.devDependencies?.typescript, "5");
    const discordVersion = cleanVersion(pkg.dependencies?.["discord.js"], "14");
    const embed = new EmbedBuilder()
      .setColor(randomColor())
      .addFields(
        { name: `${emoji.application("devs", "👥")} Criadores`, value: CREATOR_NAME, inline: true },
        { name: `${emoji.application("typescript", "🟦")} Linguagem`, value: `TypeScript ${typescriptVersion}`, inline: true },
        { name: `${emoji.application("palette", "🎨")} Designer`, value: ARTIST_NAME, inline: true },
        { name: `${emoji.clock} Online`, value: formatUptime(uptimeSeconds), inline: true },
        { name: `${emoji.application("discord", "🛠️")} Versão`, value: `discord.js ${discordVersion} · Rascal ${pkg.version}`, inline: true },
        { name: `${emoji.online} Host`, value: `Node.js ${process.version} · ${getHostLabel()}`, inline: true },
        { name: `${emoji.ping} Ping`, value: ping >= 0 ? `${Math.round(ping)} ms` : "Reconectando…", inline: true },
        { name: `${emoji.calendar} Criado em`, value: `<t:${createdAt}:D> às <t:${createdAt}:t>`, inline: true },
      )
      .setThumbnail(botUser.displayAvatarURL({ size: 256 }))
      .setFooter({ text: "© 2026 Discord Network · Rascal" });
    return interaction.editReply({ embeds: [embed] });
  },
});
