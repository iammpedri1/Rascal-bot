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
  const total = getHistoryCount(interaction.user, null);
  const pages = totalPages(total);
  const current = clampPage(requestedPage, pages);
  const rows = getHistory(interaction.user, PAGE_SIZE, current * PAGE_SIZE, null) as TransactionRow[];
  const resolveEmoji = (name: string): string => emoji.getGuildEmoji(interaction.guild, name, "");

  const embed = new EmbedBuilder()
    .setColor(0x55e6e6)
    .setTitle(`Transações de ${interaction.user.username}`)
    .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
    .setDescription(rows.length
      ? `${rows.map(row => describeTransaction(row, resolveEmoji)).join("\n\n")}\n\nPágina ${current + 1} de ${pages} | Quantidade de Transações (${total})`
      : `Nenhuma transação registrada no momento.\n\nPágina ${current + 1} de ${pages} | Quantidade de Transações (${total})`);

  const buttons = new ActionRowBuilder().addComponents(
    emoji.setGuildButtonEmoji(new ButtonBuilder()
      .setCustomId(historyButtonId("prev", interaction.user.id, current))
      .setStyle(ButtonStyle.Danger)
      .setLabel("⬅️ Voltar")
      .setDisabled(current <= 0), interaction.guild, "previous", ""),
    emoji.setGuildButtonEmoji(new ButtonBuilder()
      .setCustomId(historyButtonId("next", interaction.user.id, current))
      .setStyle(ButtonStyle.Success)
      .setLabel("➡️ Próximo")
      .setDisabled(current >= pages - 1), interaction.guild, "next", ""),
  );

  return { embeds: [embed], components: [buttons] };
}

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("transacoes")
    .setDescription("Consulte seu histórico de transações"),

  async execute(interaction) {
    await interaction.deferReply();
    return interaction.editReply({ ...buildPage(interaction, 0), allowedMentions: { parse: [] } });
  },

  async handleButton(interaction) {
    try {
      const button = parseHistoryButtonId(interaction.customId);
      if (!button) {
        return interaction.reply({
          content: "Esta interação expirou. Utilize o comando `/transacoes` novamente.",
          flags: 64,
        });
      }
      if (interaction.user.id !== button.ownerId) {
        return interaction.reply({
          content: "Este histórico foi solicitado por outro usuário.",
          flags: 64,
        });
      }
      await interaction.deferUpdate();
      return interaction.editReply({
        ...buildPage(interaction, targetPage(button)),
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      const code = typeof error === "object" && error !== null
        ? (error as { code?: number }).code
        : undefined;
      if (code === 10062 || code === 40060 || code === 10015) return undefined;
      throw error;
    }
  },
});