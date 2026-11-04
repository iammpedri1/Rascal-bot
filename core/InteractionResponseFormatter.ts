import { EmbedBuilder, type Client, type Interaction } from "discord.js";
const { randomColor } = require("../utils/embedStyle") as { randomColor: () => number };

const RESPONSE_METHODS = new Set<PropertyKey>([
  "reply",
  "editReply",
  "followUp",
  "update",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function brandFooter(client: Client, guildName?: string | null) {
  const username = client.user?.username || "Rascal";
  const avatar = client.user?.displayAvatarURL({ size: 64 });
  return {
    text: guildName ? `${username} · ${guildName}` : username,
    ...(avatar ? { iconURL: avatar } : {}),
  };
}

function truncate(value: unknown, length: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length > length ? value.slice(0, length) : value;
}

function normalizeEmbedLimits(embed: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...embed };
  normalized.title = truncate(normalized.title, 256);
  normalized.description = truncate(normalized.description, 4096);
  if (!normalized.title) delete normalized.title;
  if (!normalized.description) delete normalized.description;

  if (Array.isArray(normalized.fields)) {
    normalized.fields = normalized.fields.slice(0, 25).map((field) => {
      const source = isRecord(field) ? field : {};
      return {
        ...source,
        name: truncate(source.name, 256) || "\u200b",
        value: truncate(source.value, 1024) || "\u200b",
      };
    });
  }

  let total = JSON.stringify(normalized).length;
  if (total > 6000 && typeof normalized.description === "string") {
    const excess = total - 6000;
    normalized.description = normalized.description.slice(0, Math.max(0, normalized.description.length - excess));
  }
  return normalized;
}

function formatEmbed(embed: unknown, client: Client, guildName?: string | null): unknown {
  const footer = brandFooter(client, guildName);

  if (embed instanceof EmbedBuilder) {
    embed.setColor(randomColor());
    if (!embed.data.footer) embed.setFooter(footer);
    return normalizeEmbedLimits(embed.toJSON() as Record<string, unknown>);
  }

  if (isRecord(embed) && "toJSON" in embed && typeof embed.toJSON === "function") {
    return formatEmbed(embed.toJSON(), client, guildName);
  }

  if (!isRecord(embed)) return embed;
  return {
    ...normalizeEmbedLimits(embed),
    color: randomColor(),
    footer: isRecord(embed.footer) ? embed.footer : footer,
  };
}

function textEmbed(text: string, client: Client, guildName?: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setDescription(text.slice(0, 4096))
    .setTimestamp();
  embed.setFooter(brandFooter(client, guildName));
  return embed;
}

function mentionTokens(text: string): string[] {
  return text.match(/<@!?\d+>|<@&\d+>|<#\d+>|@everyone|@here/g) ?? [];
}

function formatPayload(payload: unknown, client: Client, guildName?: string | null): unknown {
  if (typeof payload === "string") {
    if (!payload.trim()) return { content: payload };
    const mentions = mentionTokens(payload);
    return {
      embeds: [textEmbed(payload, client, guildName)],
      ...(mentions.length ? { content: [...new Set(mentions)].join(" ") } : {}),
    };
  }
  if (!isRecord(payload)) return payload;

  const content = typeof payload.content === "string" ? payload.content : "";
  const embeds = Array.isArray(payload.embeds)
    ? payload.embeds.map(embed => formatEmbed(embed, client, guildName))
    : [];

  if (embeds.length) return { ...payload, embeds };
  if (!content.trim()) return payload;

  const mentions = mentionTokens(content);
  const formatted: Record<string, unknown> = {
    ...payload,
    embeds: [textEmbed(content, client, guildName)],
  };

  // Keep only explicit mentions in message content so Discord can deliver the ping.
  if (mentions.length) formatted.content = [...new Set(mentions)].join(" ");
  else delete formatted.content;

  return formatted;
}

/** Applies the shared embed treatment to every interaction response from a command. */
export function withBrandedResponses<T extends Interaction>(
  interaction: T,
  client: Client,
): T {
  return new Proxy(interaction, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);
      if (RESPONSE_METHODS.has(property) && typeof value === "function") {
        return (...args: unknown[]) => {
          if (args.length > 0) {
            args[0] = formatPayload(args[0], client, target.guild?.name);
          }
          return Reflect.apply(value, target, args);
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T;
}
