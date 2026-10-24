import type { Client, EmbedBuilder } from "discord.js";

const emoji = require("./emojis") as {
  getEmoji(name: string, fallback?: string): string;
};
const { randomInt } = require("node:crypto") as Pick<typeof import("node:crypto"), "randomInt">;

const COLORS = {
  brand: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
  neutral: 0x2b2d31,
} as const;

function randomColor(): number {
  const hue = randomInt(360) / 60;
  const saturation = 0.72;
  const lightness = 0.43;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs((hue % 2) - 1));
  const match = lightness - chroma / 2;
  const sector = Math.floor(hue);
  const rgb = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ][sector].map(channel => Math.round((channel + match) * 255));

  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
}

function icon(name: string, fallback = "▫️"): string {
  return emoji.getEmoji(name, fallback);
}

function setBrandFooter(
  embed: EmbedBuilder,
  client: Pick<Client, "user"> | null | undefined,
  detail?: string,
): EmbedBuilder {
  const name = client?.user?.username || "Rascal";
  const text = detail ? `${name} · ${detail}` : name;
  const iconURL = client?.user?.displayAvatarURL?.({ size: 64 });
  embed.setFooter({ text, ...(iconURL ? { iconURL } : {}) });
  return embed;
}

function formatNumber(value: number | bigint | string | null | undefined): string {
  return Number(value || 0).toLocaleString("pt-BR");
}

function splitLines(lines: readonly string[], maxLength = 950): string[] {
  const pages = [];
  let page = "";
  for (const line of lines) {
    const next = page ? `${page}\n${line}` : line;
    if (next.length > maxLength && page) {
      pages.push(page);
      page = line;
    } else {
      page = next;
    }
  }
  if (page) pages.push(page);
  return pages;
}

module.exports = { COLORS, formatNumber, icon, randomColor, setBrandFooter, splitLines };
