import { EmbedBuilder, type Client, type Interaction } from "discord.js";

const { randomColor } = require("../utils/embedStyle") as {
  randomColor: () => number;
};

const RESPONSE_METHODS = new Set<PropertyKey>([
  "reply",
  "editReply",
  "followUp",
  "update",
]);

const FALLBACK_COLOR = 0x2b2d31;
const EMBED_TOTAL_LIMIT = 6000;
const TITLE_LIMIT = 256;
const DESCRIPTION_LIMIT = 4096;
const FIELD_NAME_LIMIT = 256;
const FIELD_VALUE_LIMIT = 1024;
const MAX_FIELDS = 25;

// ---------- helpers ----------
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value: unknown, length: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length > length ? value.slice(0, length) : value;
}

function safeColor(): number {
  try {
    const color = randomColor();
    return Number.isFinite(color) ? color : FALLBACK_COLOR;
  } catch {
    return FALLBACK_COLOR;
  }
}

// ---------- remoção de branding ----------
/**
 * Remove rodapé (ícone + nome do bot) e timestamp (hora).
 * Também limpa `author.icon_url` — em alguns comandos o Discord
 * injeta o avatar do bot por ali.
 */
function stripBranding(embed: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...embed };

  delete cleaned.footer;
  delete cleaned.timestamp;

  if (isRecord(cleaned.author) && "icon_url" in cleaned.author) {
    const { icon_url, ...authorWithoutIcon } = cleaned.author;
    cleaned.author = authorWithoutIcon;
  }

  return cleaned;
}

// ---------- normalização de limites ----------
function normalizeEmbedLimits(embed: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...embed };

  normalized.title = truncate(normalized.title, TITLE_LIMIT);
  normalized.description = truncate(normalized.description, DESCRIPTION_LIMIT);
  if (!normalized.title) delete normalized.title;
  if (!normalized.description) delete normalized.description;

  if (Array.isArray(normalized.fields)) {
    normalized.fields = normalized.fields
      .slice(0, MAX_FIELDS)
      .map((field) => {
        const source = isRecord(field) ? field : {};
        return {
          ...source,
          name: truncate(source.name, FIELD_NAME_LIMIT) || "\u200b",
          value: truncate(source.value, FIELD_VALUE_LIMIT) || "\u200b",
        };
      });
  }

  let total = 0;
  try {
    total = JSON.stringify(normalized).length;
  } catch {
    total = EMBED_TOTAL_LIMIT;
  }

  if (total > EMBED_TOTAL_LIMIT && typeof normalized.description === "string") {
    const excess = total - EMBED_TOTAL_LIMIT;
    normalized.description = normalized.description.slice(
      0,
      Math.max(0, normalized.description.length - excess),
    );
  }

  return normalized;
}

// ---------- formatação de embed ----------
function formatEmbed(embed: unknown): unknown {
  try {
    if (embed instanceof EmbedBuilder) {
      const json = embed.toJSON() as Record<string, unknown>;
      json.color = safeColor();
      return stripBranding(normalizeEmbedLimits(json));
    }

    if (isRecord(embed) && "toJSON" in embed && typeof embed.toJSON === "function") {
      return formatEmbed((embed as { toJSON(): unknown }).toJSON());
    }

    if (!isRecord(embed)) return embed;

    return {
      ...stripBranding(normalizeEmbedLimits(embed)),
      color: safeColor(),
    };
  } catch (error) {
    console.error("[formatter] falha ao formatar embed:", error);
    return embed;
  }
}

// ---------- embed a partir de texto ----------
function textEmbed(text: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(safeColor())
    .setDescription(text.slice(0, DESCRIPTION_LIMIT));
}

// ---------- menções ----------
const MENTION_PATTERN = /<@!?\d+>|<@&\d+>|<#\d+>|@everyone|@here/g;

function extractMentions(text: string): string[] {
  return text.match(MENTION_PATTERN) ?? [];
}

// ---------- payload ----------
function formatPayload(payload: unknown): unknown {
  try {
    if (typeof payload === "string") {
      if (!payload.trim()) return { content: payload };
      const mentions = extractMentions(payload);
      return {
        embeds: [textEmbed(payload)],
        ...(mentions.length ? { content: [...new Set(mentions)].join(" ") } : {}),
      };
    }

    if (!isRecord(payload)) return payload;

    const content = typeof payload.content === "string" ? payload.content : "";
    const incomingEmbeds = Array.isArray(payload.embeds) ? payload.embeds : [];
    const validEmbeds = incomingEmbeds.filter(
      (embed) => embed !== null && embed !== undefined,
    );

    if (validEmbeds.length > 0) {
      return {
        ...payload,
        embeds: validEmbeds.map(formatEmbed),
        allowedMentions: isRecord(payload.allowedMentions)
          ? { ...payload.allowedMentions, repliedUser: false }
          : { repliedUser: false },
      };
    }

    if (!content.trim()) return payload;

    const mentions = extractMentions(content);
    const formatted: Record<string, unknown> = {
      ...payload,
      embeds: [textEmbed(content)],
      allowedMentions: isRecord(payload.allowedMentions)
        ? { ...payload.allowedMentions, repliedUser: false }
        : { repliedUser: false },
    };

    if (mentions.length) formatted.content = [...new Set(mentions)].join(" ");
    else delete formatted.content;

    return formatted;
  } catch (error) {
    console.error("[formatter] falha ao formatar payload:", error);
    return payload;
  }
}

// ---------- export ----------
/**
 * Envolve a interação para aplicar o formatter em todas as respostas.
 * Rodapé (ícone/nome) e timestamp (hora) são removidos de todos os embeds.
 */
export function withBrandedResponses<T extends Interaction>(
  interaction: T,
  _client?: Client,
): T {
  return new Proxy(interaction, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);

      if (RESPONSE_METHODS.has(property) && typeof value === "function") {
        return (...args: unknown[]) => {
          try {
            if (args.length > 0) args[0] = formatPayload(args[0]);
          } catch (error) {
            console.error("[formatter] falha antes do envio; usando payload original:", error);
          }
          return Reflect.apply(value, target, args);
        };
      }

      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T;
}