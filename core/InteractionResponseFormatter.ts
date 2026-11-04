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

function formatEmbed(embed: unknown, client: Client, guildName?: string | null): unknown {
  if (embed instanceof EmbedBuilder) {
    embed.setColor(randomColor());
    return embed;
  }

  if (isRecord(embed) && "toJSON" in embed && typeof embed.toJSON === "function") {
    return formatEmbed(embed.toJSON(), client, guildName);
  }

  if (!isRecord(embed)) return embed;
  return { ...embed, color: randomColor() };
}

function textEmbed(text: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(randomColor())
    .setDescription(text.slice(0, 4096))
    .setTimestamp();
}

function mentionTokens(text: string): string[] {
  return text.match(/<@!?\d+>|<@&\d+>|<#\d+>|@everyone|@here/g) ?? [];
}

function formatPayload(payload: unknown, client: Client, guildName?: string | null): unknown {
  if (typeof payload === "string") {
    if (!payload.trim()) return { content: payload };
    const mentions = mentionTokens(payload);
    return {
      embeds: [textEmbed(payload)],
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
    embeds: [textEmbed(content)],
  };


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
