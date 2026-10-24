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
    `Bilhete: **${game.price.toLocaleString("pt-BR")} cookies** · escolha três posições.`,
    `Revelados: **${game.picks.length}/3**${revealed.length ? ` · ${revealed.join("  ")}` : ""}`,
    complete
      ? game.status === "won"
        ? `${emoji.application("correct", "✅")} Três cookies iguais! Você ganhou **${game.prize.toLocaleString("pt-BR")} cookies**.`
        : game.status === "refunded"
          ? "A raspadinha expirou e o valor do bilhete foi devolvido."
          : `${emoji.application("pand_police", "🎟️")} Não saiu a combinação de três cookies. Tente outra raspadinha.`
      : "Três cookies iguais pagam **10.000 cookies**. O cartão expira em 15 minutos; se isso acontecer, o bilhete é devolvido.",
  ].join("\n\n");

  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${emoji.application("ticket", "🎟️")} Raspadinha do servidor`)
    .setDescription(description)
    .setFooter({ text: `Cartão de ${game.userId}` });

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
    const result = scratch.startScratchGame(interaction.user, interaction.guild.id, interaction.channelId);
    if (result.ok === false) {
      if (result.reason === "balance") {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(randomColor()).setDescription("Você precisa de **500 cookies** para comprar este bilhete.")],
          components: [],
        });
      }
      const active = result.game;
      const link = active?.messageId
        ? `\n\nSua partida já está aberta: https://discord.com/channels/${active.guildId}/${active.channelId}/${active.messageId}`
        : " Sua raspadinha anterior está sendo preparada; tente novamente em instantes.";
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(randomColor()).setDescription(`Você já tem uma raspadinha ativa.${link}`)],
        components: [],
      });
    }

    try {
      scratch.activateScratchGame(result.game.id);
      const message = await interaction.editReply(render({ ...result.game, status: "open" }));
      scratch.attachScratchMessage(result.game.id, message.id);
    } catch (error) {
      scratch.cancelPendingScratchGame(result.game.id);
      logger.error("Não foi possível publicar a raspadinha; bilhete estornado", error, { gameId: result.game.id });
      throw error;
    }
  },

  async handleButton(interaction) {
    const [, gameId, cellText] = interaction.customId.split("|");
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
      return interaction.editReply(render(result.game));
    }
    if (result.game) {
      await interaction.editReply(render(result.game));
    }
    if (result.reason === "expired") {
      return interaction.followUp({ content: "A raspadinha expirou; os 500 cookies foram devolvidos.", flags: MessageFlags.Ephemeral });
    }
    if (result.reason === "finished") return;
    return interaction.followUp({ content: "Não foi possível revelar essa posição. Tente novamente.", flags: MessageFlags.Ephemeral });
  },
});
