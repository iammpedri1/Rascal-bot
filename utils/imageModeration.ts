const logger = require("./logger");

const API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const MODEL = String(process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest").trim();
const MAX_IMAGES = Math.max(1, Math.min(4, Number(process.env.AUTOMOD_IMAGE_MAX_PER_MESSAGE || 3)));
const MAX_IMAGE_BYTES = Math.max(100_000, Math.min(20_000_000, Number(process.env.AUTOMOD_IMAGE_MAX_BYTES || 10_000_000)));
const TIMEOUT_MS = Math.max(2_000, Math.min(15_000, Number(process.env.AUTOMOD_IMAGE_TIMEOUT_MS || 8_000)));
const SCORE_THRESHOLD = Math.max(0.5, Math.min(1, Number(process.env.AUTOMOD_IMAGE_SCORE_THRESHOLD || 0.9)));

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const DISCORD_CDN_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);

function attachmentsForModeration(message) {
  return [...message.attachments.values()]
    .filter(attachment => {
      const contentType = String(attachment.contentType || "").split(";")[0].toLowerCase();
      const extension = String(attachment.name || "").toLowerCase().match(/\.(png|jpe?g|webp|gif)$/)?.[1];
      const inferredType = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension ? `image/${extension}` : "";
      if (!IMAGE_TYPES.has(contentType || inferredType)) return false;
      if (!Number.isFinite(attachment.size) || attachment.size > MAX_IMAGE_BYTES) return false;
      try {
        const url = new URL(attachment.url);
        return url.protocol === "https:" && DISCORD_CDN_HOSTS.has(url.hostname);
      } catch {
        return false;
      }
    })
    .slice(0, MAX_IMAGES);
}

function isRestricted(result, nsfwChannel) {
  const scores = result?.category_scores || {};
  const categories = result?.categories || {};
  const score = key => Number(scores[key] ?? 0);
  const flagged = key => Boolean(categories[key]);
  const sexual = score("sexual") >= SCORE_THRESHOLD || flagged("sexual");
  const graphicViolence = score("violence/graphic") >= SCORE_THRESHOLD || flagged("violence/graphic");
  const violence = score("violence") >= Math.max(SCORE_THRESHOLD, 0.95) || flagged("violence");
  return (!nsfwChannel && sexual) || graphicViolence || violence;
}

/** Scans only Discord-hosted image attachments; the moderation provider receives image URLs, not message authors' credentials. */
async function moderateImageAttachments(message) {
  const attachments = attachmentsForModeration(message);
  if (!attachments.length || !API_KEY) return { scanned: false, flagged: false, reason: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  timer.unref?.();

  try {
    const input = [
      ...(message.content ? [{ type: "text", text: String(message.content).slice(0, 2000) }] : []),
      ...attachments.map(attachment => ({
        type: "image_url",
        image_url: { url: attachment.url },
      })),
    ];
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Moderation API respondeu ${response.status}: ${body.slice(0, 300)}`);
    }

    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];
    const result = results[0];
    if (!result) throw new Error("A API não retornou resultado de moderação.");

    const flagged = isRestricted(result, Boolean(message.channel?.nsfw));
    const categories = result.categories || {};
    const reason = [
      categories.sexual && !message.channel?.nsfw ? "conteúdo sexual" : null,
      categories["violence/graphic"] ? "violência gráfica" : null,
      categories.violence ? "violência" : null,
    ].filter(Boolean).join(", ") || "conteúdo sinalizado pela moderação de imagem";

    return { scanned: true, flagged, reason, model: payload.model || MODEL };
  } catch (error) {
    logger.warn("Não foi possível avaliar os anexos com IA; mensagem preservada", {
      guildId: message.guild?.id,
      channelId: message.channelId,
      messageId: message.id,
      error: String((error as Error)?.message || error).slice(0, 400),
    });
    return { scanned: false, flagged: false, reason: null, error };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  moderateImageAttachments,
  isImageModerationConfigured: () => Boolean(API_KEY),
};
