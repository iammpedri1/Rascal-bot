import { defineCommand } from "../types/command";
import type { ScratchGame } from "../utils/scratchCards";
import type { SKRSContext2D } from "@napi-rs/canvas";
import type { User } from "discord.js";
import { loadCanvas, loadImageCached } from "../utils/canvas";
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");
const scratch = require("../utils/scratchCards") as typeof import("../utils/scratchCards");
const { randomColor } = require("../utils/embedStyle") as { randomColor(): number };
const emoji = require("../utils/emojis") as typeof import("../utils/emojis");
const logger = require("../utils/logger") as {
  error(message: string, error?: unknown, metadata?: Record<string, unknown>): void;
};

const SYMBOLS: Record<string, { name: string; fallback: string }> = {
  cookie: { name: "cookie", fallback: "🍪" },
  ticket: { name: "ticket", fallback: "🎟️" },
  trophy: { name: "trophy", fallback: "🏆" },
  gift: { name: "gift", fallback: "🎁" },
  party: { name: "party", fallback: "🎉" },
  booster: { name: "booster", fallback: "🚀" },
  palette: { name: "palette", fallback: "🎨" },
};


const CARD_CELL = 168;
const CARD_GAP = 14;
const CARD_PADDING = 26;
const CARD_BANNER = 64;
const CARD_WIDTH = CARD_PADDING * 2 + CARD_CELL * 3 + CARD_GAP * 2;
const CARD_HEIGHT = CARD_PADDING * 2 + CARD_BANNER + CARD_GAP + CARD_CELL * 3 + CARD_GAP * 2;

function symbolImageUrl(symbolId: string): string {
  return scratch.SCRATCH_SYMBOL_IMAGE_URLS[symbolId] ?? scratch.SCRATCH_SYMBOL_IMAGE_URLS.cookie;
}

function roundRectPath(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
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
}

/** Célula ainda coberta: textura de raspadinha + o número da posição (mesmo rótulo do botão). */
function drawCoveredCell(ctx: SKRSContext2D, x: number, y: number, position: number): void {
  const gradient = ctx.createLinearGradient(x, y, x + CARD_CELL, y + CARD_CELL);
  gradient.addColorStop(0, "#475569");
  gradient.addColorStop(1, "#1e293b");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, CARD_CELL, CARD_CELL);


  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let offset = -CARD_CELL; offset < CARD_CELL; offset += 14) {
    ctx.beginPath();
    ctx.moveTo(x + offset, y);
    ctx.lineTo(x + offset + CARD_CELL, y + CARD_CELL);
    ctx.stroke();
  }

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "bold 64px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(position), x + CARD_CELL / 2, y + CARD_CELL / 2);
}

/** Desenha o cartão: banner, posições cobertas com número e posições reveladas com a imagem. */
async function renderCardImage(game: ScratchGame): Promise<Buffer> {
  const { createCanvas } = loadCanvas();
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);


  const bannerWidth = CARD_WIDTH - CARD_PADDING * 2;
  const bannerGradient = ctx.createLinearGradient(CARD_PADDING, 0, CARD_PADDING + bannerWidth, 0);
  bannerGradient.addColorStop(0, "#ec4899");
  bannerGradient.addColorStop(1, "#8b5cf6");
  ctx.fillStyle = bannerGradient;
  roundRectPath(ctx, CARD_PADDING, CARD_PADDING, bannerWidth, CARD_BANNER, 16);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RASPADINHA DA SORTE", CARD_WIDTH / 2, CARD_PADDING + CARD_BANNER / 2);

  const gridTop = CARD_PADDING + CARD_BANNER + CARD_GAP;
  for (let index = 0; index < 9; index += 1) {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const x = CARD_PADDING + column * (CARD_CELL + CARD_GAP);
    const y = gridTop + row * (CARD_CELL + CARD_GAP);
    const revealed = game.picks.includes(index);

    ctx.save();
    roundRectPath(ctx, x, y, CARD_CELL, CARD_CELL, 18);
    ctx.clip();

    if (revealed) {
      const symbol = SYMBOLS[game.grid[index]] ?? SYMBOLS.cookie;
      try {
        const image = await loadImageCached(symbolImageUrl(game.grid[index]));
        ctx.drawImage(image, x, y, CARD_CELL, CARD_CELL);
      } catch {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(x, y, CARD_CELL, CARD_CELL);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 68px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(symbol.fallback, x + CARD_CELL / 2, y + CARD_CELL / 2);
      }
    } else {
      drawCoveredCell(ctx, x, y, index + 1);
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, CARD_CELL, CARD_CELL, 18);
    ctx.stroke();
  }

  return canvas.toBuffer("image/png");
}

async function render(game: ScratchGame) {
  const complete = game.status !== "open" && game.status !== "pending";
  const image = await renderCardImage(game);
  const attachment = new AttachmentBuilder(image, { name: "raspadinha.png" });

  const won = game.status === "won";
  const lost = game.status === "lost";
  const lines = [
    `**Bilhete:** ${game.price.toLocaleString("pt-BR")} cookies · **Prêmio:** ${scratch.SCRATCH_COOKIE_PRIZE.toLocaleString("pt-BR")} cookies`,
    `**Posições reveladas:** ${game.picks.length}/3`,
  ];
  if (!complete) {
    lines.push(
      "Clique nos botões **1 a 9** para raspar as posições do cartão. Três cookies iguais pagam **10.000 cookies**. O cartão expira em 15 minutos; se isso acontecer, o bilhete é devolvido.",
    );
  }
  if (won) {
    lines.push(`${emoji.application("correct", "✅")} **Parabéns!** Você revelou três cookies e ganhou **${game.prize.toLocaleString("pt-BR")} cookies** na sua raspadinha!`);
  }
  if (lost) {
    lines.push(`${emoji.application("pand_police", "😢")} **Não foi dessa vez.** Tente outra raspadinha.`);
  }
  if (game.status === "refunded") {
    lines.push("A raspadinha expirou e o valor do bilhete foi devolvido.");
  }

  const embed = new EmbedBuilder()
    .setColor(won ? 0x57f287 : lost ? 0xed4245 : randomColor())
    .setTitle(`${emoji.application("ticket", "🎟️")} Raspadinha da Sorte`)
    .setDescription(lines.join("\n\n"))
    .setImage("attachment://raspadinha.png");

  const rows = [];
  for (let offset = 0; offset < 9; offset += 3) {
    const buttons = game.grid.slice(offset, offset + 3).map((symbolId, relativeIndex) => {
      const index = offset + relativeIndex;
      const selected = game.picks.includes(index);
      const button = new ButtonBuilder()
        .setCustomId(`raspadinha|${game.id}|${index}`)
        .setStyle(selected ? (symbolId === "cookie" ? ButtonStyle.Success : ButtonStyle.Danger) : ButtonStyle.Secondary)
        .setDisabled(selected || complete || game.status !== "open");
      if (selected) {
        const symbol = SYMBOLS[symbolId] ?? SYMBOLS.cookie;
        emoji.setApplicationButtonEmoji(button, symbol.name, symbol.fallback);
      } else {
        button.setLabel(String(index + 1));
      }
      return button;
    });
    rows.push(new ActionRowBuilder().addComponents(...buttons));
  }

  if (complete) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`raspadinha|new|${game.id}`)
        .setLabel("Comprar outra")
        .setEmoji(emoji.toComponentEmoji(emoji.application("ticket", "🎟️")))
        .setStyle(ButtonStyle.Primary),
    ));
  }

  return { embeds: [embed], components: rows, files: [attachment], allowedMentions: { parse: [] } };
}

type StartOutcome = { ok: true; game: ScratchGame } | { ok: false; message: string };

function startGame(user: User, guildId: string, channelId: string): StartOutcome {
  const result = scratch.startScratchGame(user, guildId, channelId);
  if (result.ok === false) {
    if (result.reason === "balance") {
      return { ok: false, message: "Você precisa de **500 cookies** para comprar este bilhete." };
    }
    const active = result.game;
    const link = active?.messageId
      ? `\n\nSua partida já está aberta: https://discord.com/channels/${active.guildId}/${active.channelId}/${active.messageId}`
      : " Sua raspadinha anterior está sendo preparada; tente novamente em instantes.";
    return { ok: false, message: `Você já tem uma raspadinha ativa.${link}` };
  }
  scratch.activateScratchGame(result.game.id);
  return { ok: true, game: { ...result.game, status: "open" } };
}

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("raspadinha")
    .setDescription("Compre uma raspadinha e revele três posições"),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use a raspadinha no servidor do Rascal.", flags: MessageFlags.Ephemeral });
    }

    if (!interaction.channelId) {
      return interaction.reply({ content: "Não consegui identificar o canal desta raspadinha.", flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply();
    const started = startGame(interaction.user, interaction.guild.id, interaction.channelId);
    if (started.ok === false) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(randomColor()).setDescription(started.message)],
        components: [],
      });
    }

    try {
      const message = await interaction.editReply(await render(started.game));
      scratch.attachScratchMessage(started.game.id, message.id);
    } catch (error) {
      scratch.cancelPendingScratchGame(started.game.id);
      logger.error("Não foi possível publicar a raspadinha; bilhete estornado", error, { gameId: started.game.id });
      throw error;
    }
  },

  async handleButton(interaction) {
    const [, gameId, cellText] = interaction.customId.split("|");

    if (gameId === "new") {
      if (!interaction.guildId || !interaction.channelId) {
        return interaction.reply({ content: "Use a raspadinha no servidor do Rascal.", flags: MessageFlags.Ephemeral });
      }
      const finished = cellText ? scratch.getScratchGame(cellText) : null;
      if (finished && finished.userId !== interaction.user.id) {
        return interaction.reply({ content: "Esta raspadinha pertence a outra pessoa.", flags: MessageFlags.Ephemeral });
      }
      await interaction.deferUpdate();
      const started = startGame(interaction.user, interaction.guildId, interaction.channelId);
      if (started.ok === false) {
        return interaction.followUp({ content: started.message, flags: MessageFlags.Ephemeral });
      }
      try {
        await interaction.editReply(await render(started.game));
        scratch.attachScratchMessage(started.game.id, interaction.message.id);
      } catch (error) {
        scratch.cancelPendingScratchGame(started.game.id);
        logger.error("Não foi possível iniciar outra raspadinha", error, { gameId: started.game.id });
        return interaction.followUp({ content: "Não consegui iniciar outra raspadinha agora.", flags: MessageFlags.Ephemeral });
      }
      return;
    }

    const before = scratch.getScratchGame(gameId);
    if (!before) {
      return interaction.reply({ content: "Esta raspadinha não está mais disponível.", flags: MessageFlags.Ephemeral });
    }
    if (before.userId !== interaction.user.id || before.guildId !== interaction.guildId) {
      return interaction.reply({ content: "Esta raspadinha pertence a outra pessoa.", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferUpdate();
    const result = scratch.selectScratchCell(gameId, interaction.user.id, Number(cellText));
    if (result.ok === true) {
      return interaction.editReply(await render(result.game));
    }
    if (result.game) {
      await interaction.editReply(await render(result.game));
    }
    if (result.reason === "expired") {
      return interaction.followUp({ content: "A raspadinha expirou; os 500 cookies foram devolvidos.", flags: MessageFlags.Ephemeral });
    }
    if (result.reason === "finished") return;
    return interaction.followUp({ content: "Não foi possível revelar essa posição. Tente novamente.", flags: MessageFlags.Ephemeral });
  },
});
