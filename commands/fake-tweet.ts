import { defineCommand } from "../types/command";
const {
  AttachmentBuilder,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");
const { loadCanvas } = require("../utils/canvas");
const { generateFakeTweetMetrics } = require("../utils/fakeTweetMetrics");

const CARD_WIDTH = 1240;
const CARD_HEIGHT = 480;
const CARD_PADDING = 32;
const BODY_LINE_HEIGHT = 58;
const AVATAR_TIMEOUT_MS = 3500;
const CARD_COLOR = "#ffffff";
const TEXT_COLOR = "#17202a";
const MUTED_COLOR = "#657786";

function graphemes(text): string[] {
  if (typeof Intl.Segmenter === "function") {
    return [...new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(text)]
      .map(segment => segment.segment);
  }
  return Array.from(text);
}

function splitLongWord(context, word, maxWidth) {
  const segments = graphemes(word);
  const chunks = [];
  let chunk = "";

  for (const segment of segments) {
    const candidate = `${chunk}${segment}`;
    if (chunk && context.measureText(candidate).width > maxWidth) {
      chunks.push(chunk);
      chunk = segment;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function wrapText(context, text, maxWidth) {
  const normalized = String(text).trim();
  if (!normalized) return [""];

  const words = normalized.split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else if (line) {
      lines.push(line);
      line = "";
      const chunks = splitLongWord(context, word, maxWidth);
      lines.push(...chunks.slice(0, -1));
      line = chunks.at(-1) || "";
    } else {
      const chunks = splitLongWord(context, word, maxWidth);
      lines.push(...chunks.slice(0, -1));
      line = chunks.at(-1) || "";
    }
  }

  if (line) lines.push(line);
  return lines;
}

function drawAvatar(context, avatar, x, y, size) {
  context.save();
  context.beginPath();
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  context.clip();

  if (avatar) {
    context.drawImage(avatar, x, y, size, size);
  } else {
    context.fillStyle = "#d9e1e8";
    context.fillRect(x, y, size, size);
  }

  context.restore();
}

async function loadAvatar(url): Promise<any> {
  const { loadImage } = loadCanvas();
  let timeout;
  try {
    return await Promise.race([
      loadImage(url).catch(() => null),
      new Promise<any>(resolve => {
        timeout = setTimeout(() => resolve(null), AVATAR_TIMEOUT_MS);
        timeout.unref?.();
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function createTweetCard(user, message, options: any = {}) {
  const { createCanvas } = loadCanvas();
  let canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  let context = canvas.getContext("2d");
  const avatarUrl = Object.hasOwn(options, "avatarUrl")
    ? options.avatarUrl
    : user.displayAvatarURL?.({ extension: "png", size: 256 });
  const avatar = avatarUrl ? await loadAvatar(avatarUrl) : null;
  const contentX = CARD_PADDING;
  const contentWidth = CARD_WIDTH - CARD_PADDING * 2;
  const now = new Date();
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now).replace(".", "");

  context.fillStyle = CARD_COLOR;
  context.font = "52px Arial";
  const wrappedLines = wrapText(context, message, contentWidth);
  const lines = wrappedLines;
  const extraHeight = Math.max(0, lines.length - 1) * BODY_LINE_HEIGHT;
  if (extraHeight) {
    canvas.height = CARD_HEIGHT + extraHeight;
    context = canvas.getContext("2d");
  }
  context.fillStyle = CARD_COLOR;

  const metadataY = 320 + extraHeight;
  const dividerY = 344 + extraHeight;
  const metricsY = 419 + extraHeight;
  const lowerDividerY = 466 + extraHeight;
  const displayName = `${user.globalName || user.username}${user.discriminator && user.discriminator !== "0" ? `#${user.discriminator}` : ""}`;
  const rightContentX = CARD_WIDTH - CARD_PADDING;
  const avatarSize = 112;
  const textX = contentX + avatarSize + 28;
  const headerWidth = rightContentX - textX - 40;

  context.beginPath();
  context.roundRect(0, 0, CARD_WIDTH, canvas.height, 8);
  context.fill();
  drawAvatar(context, avatar, contentX, 40, avatarSize);

  context.fillStyle = TEXT_COLOR;
  context.font = "bold 36px Arial";
  context.fillText(displayName, textX, 82, headerWidth);

  context.fillStyle = MUTED_COLOR;
  context.font = "36px Arial";
  context.fillText(`@${user.username}#${user.discriminator || "0"}`, textX, 122, headerWidth);
  context.font = "bold 34px Arial";
  context.fillText("•••", CARD_WIDTH - CARD_PADDING - 42, 82);

  context.fillStyle = TEXT_COLOR;
  context.font = "52px Arial";
  const textY = 245;
  lines.forEach((line, index) => {
    context.fillText(line, contentX, textY + index * BODY_LINE_HEIGHT);
  });

  const metrics = generateFakeTweetMetrics();
  context.strokeStyle = "#d8dee4";
  context.lineWidth = 2;
  context.fillStyle = MUTED_COLOR;
  context.font = "36px Arial";
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  context.fillText(`${time} · ${date} · Twitter for Discord`, contentX, metadataY, contentWidth);
  context.beginPath();
  context.moveTo(contentX, dividerY);
  context.lineTo(CARD_WIDTH - contentX, dividerY);
  context.stroke();

  const metricGroups = [
    { value: metrics.reposts, label: "Retweets", x: 32 },
    { value: metrics.comments, label: "Quote Tweets", x: 340 },
    { value: metrics.likes, label: "Likes", x: 716 },
  ];
  metricGroups.forEach(({ value, label, x }) => {
    const formattedValue = value.toLocaleString("pt-BR");
    context.font = "bold 36px Arial";
    context.fillStyle = TEXT_COLOR;
    context.fillText(formattedValue, x, metricsY);
    const labelX = x + context.measureText(formattedValue).width + 10;
    context.font = "36px Arial";
    context.fillStyle = MUTED_COLOR;
    context.fillText(label, labelX, metricsY);
  });
  context.beginPath();
  context.moveTo(contentX, lowerDividerY);
  context.lineTo(CARD_WIDTH - contentX, lowerDividerY);
  context.stroke();
  return canvas.toBuffer("image/png");
}

module.exports = defineCommand({
  CARD_HEIGHT,
  CARD_WIDTH,
  createTweetCard,
  wrapText,
  category: "fun",

  data: new SlashCommandBuilder()
    .setName("fake-tweet")
    .setDescription("Cria um card no estilo Twitter com sua mensagem")
    .addStringOption(option =>
      option
        .setName("mensagem")
        .setDescription("Texto que aparecerá no tweet")
        .setRequired(true)
        .setMaxLength(280)
    ),

  async execute(interaction) {
    const message = interaction.options.getString("mensagem", true).trim();

    if (!message) {
      return interaction.reply({
        content: "Digite uma mensagem para criar o tweet.",
        flags: 64,
      });
    }

    await interaction.deferReply();
    const image = await createTweetCard(interaction.user, message);
    const attachment = new AttachmentBuilder(image, { name: "fake-tweet.png" });
    return interaction.editReply({
      files: [attachment],
      allowedMentions: { parse: [] },
    });
  },
});
