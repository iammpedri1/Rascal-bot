const { AttachmentBuilder, EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const emoji = require("../utils/emojis");

const WIDTH = 1100;
const HEIGHT = 520;
const CARD_RADIUS = 28;
const SHIP_EMOJI = "<a:ablobcouple:1500896909332840569>";

function displayName(user) {
  return user.globalName || user.username || "Usuario";
}

function cleanName(name) {
  return String(name || "amor")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

function shipName(userA, userB) {
  const first = cleanName(displayName(userA));
  const second = cleanName(displayName(userB));
  const left = first.slice(0, Math.max(2, Math.ceil(first.length / 2)));
  const right = second.slice(Math.max(0, Math.floor(second.length / 2)));

  return `${left}${right}` || "Casal";
}

function compatibility(userA, userB) {
  if (userA.id === userB.id) return 100;

  const key = [userA.id, userB.id].sort().join(":");
  let hash = 2166136261;

  for (const char of key) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash % 101;
}

function verdict(percent) {
  if (percent === 100) return "Amor proprio impecavel. Ninguem compete.";
  if (percent >= 90) return "Casal lendario. A timeline nao estava pronta.";
  if (percent >= 75) return "Quimica forte, energia boa e perigo de virar fanfic.";
  if (percent >= 55) return "Combina bem. Tem conversa, tem clima, tem chance.";
  if (percent >= 35) return "Pode render, mas vai precisar de paciencia e timing.";
  if (percent >= 15) return "Talvez amizade seja o caminho mais saudavel.";
  return "O destino olhou, pensou um pouco e pediu para tentar outro par.";
}

function parseEmoji(value) {
  const match = String(value || "").match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
  if (!match) return value;

  return {
    name: match[1],
    id: match[2],
    animated: value.startsWith("<a:"),
  };
}

function customEmoji(guild, names, fallback) {
  const wanted = names.map(name => name.toLowerCase());
  const found = guild?.emojis?.cache?.find(item =>
    wanted.some(name => item.name.toLowerCase().includes(name))
  );

  return found ? found.toString() : fallback;
}

function shipEmojis(guild) {
  return {
    filled: customEmoji(guild, ["heart", "love", "coracao", "like"], "💖"),
    empty: customEmoji(guild, ["empty", "gray", "cinza", "off", "dislike"], "🖤"),
    couple: customEmoji(guild, ["couple", "ship", "casal"], SHIP_EMOJI),
    spark: customEmoji(guild, ["spark", "party", "star"], emoji.party || "✨"),
  };
}

function progressBar(percent, icons) {
  const total = 10;
  const filled = Math.round((percent / 100) * total);

  return Array.from({ length: total }, (_, index) =>
    index < filled ? icons.filled : icons.empty
  ).join("");
}

function fillRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
}

function fitText(ctx, text, maxWidth, baseSize, weight = "700") {
  let size = baseSize;

  do {
    ctx.font = `${weight} ${size}px Arial`;
    if (ctx.measureText(text).width <= maxWidth) return;
    size -= 2;
  } while (size >= 16);
}

function drawCircleAvatar(ctx, image, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();

  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.fillStyle = "#5865f2";
    ctx.fillRect(x, y, size, size);
  }

  ctx.restore();

  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 2, 0, Math.PI * 2);
  ctx.stroke();
}

async function loadAvatar(user) {
  try {
    return await loadImage(user.displayAvatarURL({ extension: "png", size: 256 }));
  } catch {
    return null;
  }
}

function drawProfileCard(ctx, user, image, x, align = "left") {
  ctx.fillStyle = "#ffffff";
  fillRoundRect(ctx, x, 116, 300, 288, CARD_RADIUS);

  ctx.strokeStyle = "rgba(15, 23, 42, 0.08)";
  ctx.lineWidth = 2;
  strokeRoundRect(ctx, x, 116, 300, 288, CARD_RADIUS);

  drawCircleAvatar(ctx, image, x + 60, 146, 180);

  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  fitText(ctx, displayName(user), 230, 30);
  ctx.fillText(displayName(user), x + 150, 360);

  ctx.fillStyle = "#64748b";
  ctx.font = "600 18px Arial";
  ctx.fillText(align === "left" ? "Pessoa A" : "Pessoa B", x + 150, 388);
}

async function buildShipImage(userA, userB, percent, coupleName) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);

  gradient.addColorStop(0, "#f8fafc");
  gradient.addColorStop(0.48, "#fdf2f8");
  gradient.addColorStop(1, "#eef2ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#ffffff";
  fillRoundRect(ctx, 38, 34, WIDTH - 76, HEIGHT - 68, 36);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.08)";
  ctx.lineWidth = 2;
  strokeRoundRect(ctx, 38, 34, WIDTH - 76, HEIGHT - 68, 36);

  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.font = "800 34px Arial";
  ctx.fillText("SHIP REPORT", WIDTH / 2, 82);

  ctx.fillStyle = "#64748b";
  ctx.font = "600 18px Arial";
  ctx.fillText("compatibilidade deterministica por ID", WIDTH / 2, 110);

  const [avatarA, avatarB] = await Promise.all([loadAvatar(userA), loadAvatar(userB)]);
  drawProfileCard(ctx, userA, avatarA, 92, "left");
  drawProfileCard(ctx, userB, avatarB, 708, "right");

  ctx.fillStyle = "#111827";
  fillRoundRect(ctx, 430, 142, 240, 238, 30);

  ctx.fillStyle = "#f472b6";
  ctx.beginPath();
  ctx.arc(WIDTH / 2 - 32, 218, 48, 0, Math.PI * 2);
  ctx.arc(WIDTH / 2 + 32, 218, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 78, 232);
  ctx.lineTo(WIDTH / 2 + 78, 232);
  ctx.lineTo(WIDTH / 2, 330);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 62px Arial";
  ctx.fillText(`${percent}%`, WIDTH / 2, 248);

  ctx.fillStyle = "#e2e8f0";
  fillRoundRect(ctx, 460, 312, 180, 20, 10);
  const barWidth = Math.max(8, Math.round(180 * (percent / 100)));
  const barGradient = ctx.createLinearGradient(460, 312, 640, 312);
  barGradient.addColorStop(0, "#fb7185");
  barGradient.addColorStop(1, "#facc15");
  ctx.fillStyle = barGradient;
  fillRoundRect(ctx, 460, 312, barWidth, 20, 10);

  ctx.fillStyle = "#ffffff";
  fitText(ctx, coupleName, 190, 28, "800");
  ctx.fillText(coupleName, WIDTH / 2, 362);

  ctx.fillStyle = "#475569";
  ctx.font = "700 18px Arial";
  ctx.fillText("nome do casal", WIDTH / 2, 394);

  return canvas.toBuffer("image/png");
}

module.exports = {
  category: "action",

  data: new SlashCommandBuilder()
    .setName("ship")
    .setDescription("Calcula o ship entre duas pessoas")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Primeira pessoa do ship")
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName("usuario2")
        .setDescription("Segunda pessoa do ship")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const first = interaction.options.getUser("usuario");
    const second = interaction.options.getUser("usuario2") || interaction.user;
    const percent = compatibility(first, second);
    const coupleName = shipName(first, second);
    const icons = shipEmojis(interaction.guild);
    const image = await buildShipImage(first, second, percent, coupleName);
    const attachment = new AttachmentBuilder(image, { name: "ship-report.png" });

    const embed = new EmbedBuilder()
      .setColor(percent >= 70 ? 0xf472b6 : percent >= 40 ? 0xf59e0b : 0x64748b)
      .setAuthor({
        name: "Resultado do ship",
        iconURL: interaction.client.user.displayAvatarURL({ size: 128 }),
      })
      .setTitle(`${icons.couple} ${displayName(first)} + ${displayName(second)}`)
      .setDescription(
        [
          `${icons.spark} **Nome do casal:** ${coupleName}`,
          `${emoji.likeLed} **Compatibilidade:** ${percent}%`,
          progressBar(percent, icons),
          "",
          verdict(percent),
        ].join("\n")
      )
      .addFields(
        {
          name: "Pessoa A",
          value: `${first}\n\`${first.id}\``,
          inline: true,
        },
        {
          name: "Pessoa B",
          value: `${second}\n\`${second.id}\``,
          inline: true,
        }
      )
      .setThumbnail(first.displayAvatarURL({ size: 256 }))
      .setImage("attachment://ship-report.png")
      .setFooter({
        text: "O resultado e fixo para o mesmo par de usuarios.",
        iconURL: second.displayAvatarURL({ size: 64 }),
      })
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });
  },
};
