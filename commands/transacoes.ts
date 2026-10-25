import { defineCommand } from "../types/command";
import type { TransactionRow } from "../utils/transactionHistory";
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");
const emoji = require("../utils/emojis") as typeof import("../utils/emojis");
const { randomColor } = require("../utils/embedStyle");
const { getHistory, getHistoryCount } = require("../utils/cookieEconomy");
const {
  PAGE_SIZE,
  clampPage,
  describeTransaction,
  historyButtonId,
  parseHistoryButtonId,
  targetPage,
  totalPages,
} = require("../utils/transactionHistory") as typeof import("../utils/transactionHistory");

function buildPage(interaction, requestedPage: number) {
  const total = getHistoryCount(interaction.user);
  const pages = totalPages(total);
  const current = clampPage(requestedPage, pages);
  const rows = getHistory(interaction.user, PAGE_SIZE, current * PAGE_SIZE) as TransactionRow[];
  const resolveEmoji = (name: string): string => emoji.getGuildEmoji(interaction.guild, name, "");
  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`Transações de ${interaction.user.username}`)
    .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
    .setDescription(rows.length
      ? rows.map(row => describeTransaction(row, resolveEmoji)).join("\n\n")
      : "Nenhuma transação foi registrada ainda.")
    .setFooter({ text: `Página ${current + 1} de ${pages} · Quantidade de transações: ${total}` });

  const buttons = new ActionRowBuilder().addComponents(
    emoji.setGuildButtonEmoji(new ButtonBuilder()
      .setCustomId(historyButtonId("prev", interaction.user.id, current))
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Voltar")
      .setDisabled(current <= 0), interaction.guild, "previous", ""),
    emoji.setGuildButtonEmoji(new ButtonBuilder()
      .setCustomId(historyButtonId("next", interaction.user.id, current))
      .setStyle(ButtonStyle.Success)
      .setLabel("Próxima")
      .setDisabled(current >= pages - 1), interaction.guild, "next", ""),
  );

  return { embeds: [embed], components: [buttons] };
}

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("transacoes")
    .setDescription("Consulte seu histórico completo de transações de cookies"),

  async execute(interaction) {
    return interaction.reply({ ...buildPage(interaction, 0), allowedMentions: { parse: [] } });
  },

  async handleButton(interaction) {
    const button = parseHistoryButtonId(interaction.customId);
    if (!button) {
      return interaction.reply({ content: "Este botão expirou. Use /transacoes novamente.", flags: 64 });
    }
    if (interaction.user.id !== button.ownerId) {
      return interaction.reply({ content: "Este histórico foi aberto por outra pessoa.", flags: 64 });
    }
    return interaction.update({ ...buildPage(interaction, targetPage(button)), allowedMentions: { parse: [] } });
  },
});