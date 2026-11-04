import { defineCommand } from "../types/command";
import type { ScratchGame } from "../utils/scratchCards";
const {
  ActionRowBuilder,
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
const { loadCanvas } = require("../utils/canvas") as typeof import("../utils/canvas");

const SYMBOLS: Record<string, { name: string; fallback: string }> = {
  cookie: { name: "cookie", fallback: "🍪" },
  ticket: { name: "ticket", fallback: "🎟️" },
  trophy: { name: "trophy", fallback: "🏆" },
  gift: { name: "gift", fallback: "🎁" },
  party: { name: "party", fallback: "🎉" },
  booster: { name: "booster", fallback: "🚀" },
  palette: { name: "palette", fallback: "🎨" },
};

function render(game: ScratchGame) {
  const complete = game.status !== "open" && game.status !== "pending";
  const revealed = game.picks.map((index) => {
    const symbol = SYMBOLS[game.grid[index]] || SYMBOLS.cookie;
    return emoji.application(symbol.name, symbol.fallback);
  });
  const description = [
    `Custo do bilhete: **${game.price.toLocaleString("pt-BR")} cookies** · Selecione três posições para revelar.`,
    `Revelados: **${game.picks.length}/3**${revealed.length ? ` · ${revealed.join("  ")}` : ""}`,
    complete
      ? game.status === "won"
        ? `${emoji.application("correct", "✅")} Combinação perfeita! Você ganhou **${game.prize.toLocaleString("pt-BR")}	cookies**.`
        : game.status === "refunded"
          ? "O tempo limite da raspadinha expirou; o valor do bilhete foi estornado."
          : `${emoji.application("pand_police", "🎟️")} Não foi desta vez. Tente a sorte com um novo bilhete!`
      : "Três símbolos idênticos premiam **10.000 cookies**. O bilhete expira em 15 minutos; em caso de expiração, o valor é estornado.",
  ].join("\n\n");

  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${emoji.application("ticket", "🎟️")} Raspadinha da Comunidade`)
    .setDescription(description)
    .setImage("attachment://raspadinha.png")
    .setFooter({ text: `Bilhete de: ${game.userId}` });

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
        const symbol = SYMBOLS[symbolId] || SYMBOLS.cookie;
        emoji.setApplicationButtonEmoji(button, symbol.name, symbol.fallback);
      } else {
        button.setLabel(String(index + 1));
      }

      return button;
    });
    rows.push(new ActionRowBuilder().addComponents(...buttons));
  }
  return { embeds: [embed], components: rows, allowedMentions: { parse: [] } };
}

function renderCanvas(game: ScratchGame): Buffer {
  const { createCanvas } = loadCanvas();
  const canvas = createCanvas(900, 260);
  const context = canvas.getContext("2d");
  context.fillStyle = "#18191c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ff007f";
  context.font = "bold 30px sans-serif";
  context.fillText("RASPADINHA", 32, 48);
  for (let index = 0; index < game.grid.length; index += 1) {
    const x = 32 + (index % 3) * 280;
    const y = 78 + Math.floor(index / 3) * 58;
    const selected = game.picks.includes(index);
    context.fillStyle = selected ? "#57f287" : "#2f3136";
    context.roundRect(x, y, 250, 42, 8);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "22px sans-serif";
    context.fillText(selected ? game.grid[index].toUpperCase() : `POSIÇÃO ${index + 1}`, x + 14, y + 28);
  }
  return canvas.toBuffer("image/png");
}

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("raspadinha")
    .setDescription("Adquira um bilhete de raspadinha e tente a sorte para ganhar cookies"),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Este minijogo está disponível apenas no servidor oficial.", flags: MessageFlags.Ephemeral });
    }

    if (!interaction.channelId) {
      return interaction.reply({ content: "Ocorreu um erro ao identificar o canal de origem.", flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply();
    const result = scratch.startScratchGame(interaction.user, interaction.guild.id, interaction.channelId);
    if (result.ok === false) {
      if (result.reason === "balance") {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(randomColor()).setDescription("Saldo insuficiente. O custo de participação é de **500 cookies**.")],
          components: [],
        });
      }
      const active = result.game;
      const link = active?.messageId
        ? `\n\nSua partida já está em andamento: https://discord.com/channels/${active.guildId}/${active.channelId}/${active.messageId}`
        : " Sua raspadinha anterior está sendo processada; por favor, aguarde alguns instantes.";
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(randomColor()).setDescription(`Você já possui uma sessão ativa de raspadinha.${link}`)],
        components: [],
      });
    }

    try {
      scratch.activateScratchGame(result.game.id);
      const message = await interaction.editReply({
        ...render({ ...result.game, status: "open" }),
        files: [{ attachment: renderCanvas({ ...result.game, status: "open" }), name: "raspadinha.png" }],
      });
      scratch.attachScratchMessage(result.game.id, message.id);
    } catch (error) {
      scratch.cancelPendingScratchGame(result.game.id);
      logger.error("Falha ao publicar a raspadinha; bilhete estornado", error, { gameId: result.game.id });
      throw error;
    }
  },

  async handleButton(interaction) {
    const [, gameId, cellText] = interaction.customId.split("|");
    const before = scratch.getScratchGame(gameId);
    if (!before) {
      return interaction.reply({ content: "Este bilhete não está mais disponível no sistema.", flags: MessageFlags.Ephemeral });
    }
    if (before.userId !== interaction.user.id || before.guildId !== interaction.guildId) {
      return interaction.reply({ content: "Este bilhete pertence a outro usuário.", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferUpdate();
    const result = scratch.selectScratchCell(gameId, interaction.user.id, Number(cellText));
    if (result.ok === true) {
      return interaction.editReply({
        ...render(result.game),
        files: [{ attachment: renderCanvas(result.game), name: "raspadinha.png" }],
      });
    }
    if (result.game) {
      await interaction.editReply({
        ...render(result.game),
        files: [{ attachment: renderCanvas(result.game), name: "raspadinha.png" }],
      });
    }
    if (result.reason === "expired") {
      return interaction.followUp({ content: "O bilhete expirou; o valor de 500 cookies foi estornado.", flags: MessageFlags.Ephemeral });
    }
    if (result.reason === "finished") return;
    return interaction.followUp({ content: "Não foi possível processar a revelação desta posição. Tente novamente.", flags: MessageFlags.Ephemeral });
  },
});
