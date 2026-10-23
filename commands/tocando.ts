const {
  ActivityType,
  ApplicationIntegrationType,
  InteractionContextType,
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const CARD_WIDTH = 600;
const CARD_HEIGHT = 250;
const CARD_RADIUS = 8;
const COVER_SIZE = 175;
const COVER_X = 405;
const COVER_Y = 37;
const PROGRESS_X = 24;
const PROGRESS_Y = 202;
const PROGRESS_WIDTH = 350;
const PROGRESS_HEIGHT = 10;
const PROGRESS_COLOR = "#e7e300";
const CARD_COLOR = "#f2f3f5";
const TEXT_COLOR = "#111214";
const MUTED_TEXT_COLOR = "#313338";

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${String(minutes).padStart(2, "0")}:${seconds}`;
}

function spotifyCover(activity) {
  const image = activity.assets?.largeImage;
  if (!image?.startsWith("spotify:")) return null;
  return `https://i.scdn.co/image/${encodeURIComponent(image.slice("spotify:".length))}`;
}

function spotifyTrackUrl(activity) {
  const trackId = activity.syncId;
  return trackId && /^[A-Za-z0-9]{10,}$/.test(trackId)
    ? `https://open.spotify.com/track/${trackId}`
    : null;
}

function getSpotifyActivity(interaction) {
  const activities = interaction.member?.presence?.activities || [];
  return activities.find(activity =>
    activity.type === ActivityType.Listening &&
    activity.name?.toLowerCase() === "spotify"
  );
}

function getArtists(activity) {
  return String(activity.state || "Artista não informado")
    .split(";")
    .map(artist => artist.trim())
    .filter(Boolean)
    .join(", ");
}

function roundedPath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function drawRoundedImage(context, image, x, y, width, height, radius) {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  context.save();
  roundedPath(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  context.restore();
}

function truncate(context, value, maxWidth) {
  const text = String(value || "");
  if (context.measureText(text).width <= maxWidth) return text;

  let result = text;
  while (result.length > 1 && context.measureText(`${result}...`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
}

async function createSpotifyCard(activity) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const context = canvas.getContext("2d");
  const coverUrl = spotifyCover(activity);
  const cover = coverUrl ? await loadImage(coverUrl).catch(() => null) : null;
  const start = Number(activity.timestamps?.start || 0);
  const end = Number(activity.timestamps?.end || 0);
  const duration = end > start ? end - start : 0;
  const elapsed = start ? Math.max(0, Date.now() - start) : 0;
  const progress = duration ? Math.max(0, Math.min(1, elapsed / duration)) : 0;
  const title = activity.details || "Faixa sem título";
  const artist = getArtists(activity);
  const album = activity.assets?.largeText || "Spotify";

  context.fillStyle = CARD_COLOR;
  roundedPath(context, 0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
  context.fill();

  context.fillStyle = TEXT_COLOR;
  context.font = "bold 24px Arial";
  context.fillText(truncate(context, title, 350), 24, 48);

  context.fillStyle = MUTED_TEXT_COLOR;
  context.font = "16px Arial";
  context.fillText(`por ${truncate(context, artist, 350)}`, 24, 80);
  context.fillText(`do album ${truncate(context, album, 350)}`, 24, 108);

  context.font = "14px Arial";
  context.fillText(formatTime(elapsed), PROGRESS_X, 187);
  const totalTime = formatTime(duration);
  const totalWidth = context.measureText(totalTime).width;
  context.fillText(totalTime, PROGRESS_X + PROGRESS_WIDTH - totalWidth, 187);

  context.fillStyle = "#c9cacc";
  roundedPath(context, PROGRESS_X, PROGRESS_Y, PROGRESS_WIDTH, PROGRESS_HEIGHT, 5);
  context.fill();
  context.fillStyle = PROGRESS_COLOR;
  roundedPath(context, PROGRESS_X, PROGRESS_Y, PROGRESS_WIDTH * progress, PROGRESS_HEIGHT, 5);
  context.fill();

  if (cover) {
    drawRoundedImage(context, cover, COVER_X, COVER_Y, COVER_SIZE, COVER_SIZE, 6);
  }

  return canvas.toBuffer("image/png");
}

function buildButtons(activity) {
  const buttons = [];
  const trackUrl = spotifyTrackUrl(activity);

  if (trackUrl) {
    buttons.push(
      new ButtonBuilder()
        .setLabel("Abrir no Spotify")
        .setStyle(ButtonStyle.Link)
        .setURL(trackUrl)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId("tocando|like")
      .setEmoji("❤️")
      .setLabel("0")
      .setStyle(ButtonStyle.Primary)
  );

  return new ActionRowBuilder().addComponents(buttons);
}

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("tocando")
    .setDescription("Mostra a música que você está ouvindo no Spotify")
    .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel
    ),

  async execute(interaction) {
    if (String(process.env.DISCORD_PRESENCE_INTENT).toLowerCase() !== "true") {
      return interaction.reply({
        content: "Habilite o Presence Intent no Developer Portal e defina DISCORD_PRESENCE_INTENT=true no .env.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const activity = getSpotifyActivity(interaction);
    if (!activity) {
      return interaction.reply({
        content: "Você não está ouvindo uma música no Spotify agora.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const image = await createSpotifyCard(activity);
    const attachment = new AttachmentBuilder(image, { name: "spotify-card.png" });
    const embed = new EmbedBuilder()
      .setColor(0x1db954)
      .setAuthor({
        name: "Tocando agora • Spotify",
        iconURL: interaction.client.user.displayAvatarURL({ size: 128 }),
      })
      .setImage("attachment://spotify-card.png")
      .setFooter({ text: "Reprodução atual do Spotify" });

    return interaction.reply({
      embeds: [embed],
      files: [attachment],
      components: [buildButtons(activity)],
    });
  },

  async handleButton(interaction) {
    if (interaction.customId !== "tocando|like") return;

    return interaction.reply({
      content: "❤️ Curtida registrada!",
      flags: MessageFlags.Ephemeral,
    });
  },
};

module.exports.formatTime = formatTime;
module.exports.createSpotifyCard = createSpotifyCard;
