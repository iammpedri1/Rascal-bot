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

function buildPage(interaction, requestedPage: number, global = false) {
  const guildId = global ? interaction.guildId : null;
  const total = getHistoryCount(interaction.user, guildId);
  const pages = totalPages(total);
  const current = clampPage(requestedPage, pages);
  const rows = getHistory(interaction.user, PAGE_SIZE, current * PAGE_SIZE, guildId) as TransactionRow[];
  const resolveEmoji = (name: string): string => emoji.getGuildEmoji(interaction.guild, name, "");

  const title = global
    ? `Transações do Servidor • ${interaction.guild.name}`
    : `Transações de ${interaction.user.username}`;

  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(title)
    .setThumbnail(global ? interaction.guild.iconURL({ size: 256 }) : interaction.user.displayAvatarURL({ size: 256 }))
    .setDescription(rows.length
      ? rows.map(row => `────────────\n${describeTransaction(row, resolveEmoji)}`).join("\n")
      : "Nenhuma transação registrada no momento.")
    .addFields({
      name: "Navegação",
      value: `Página **${current + 1}** de **${pages}** · ${total} transação(ões)`,
      inline: false,
    });

  const buttons = new ActionRowBuilder().addComponents(
    emoji.setGuildButtonEmoji(new ButtonBuilder()
      .setCustomId(historyButtonId("prev", interaction.user.id, current) + (global ? "|global" : ""))
      .setStyle(ButtonStyle.Secondary)
      .setLabel("Voltar")
      .setDisabled(current <= 0), interaction.guild, "previous", ""),
    emoji.setGuildButtonEmoji(new ButtonBuilder()
      .setCustomId(historyButtonId("next", interaction.user.id, current) + (global ? "|global" : ""))
      .setStyle(ButtonStyle.Success)
      .setLabel("Próximo")
      .setDisabled(current >= pages - 1), interaction.guild, "next", ""),
  );

  return { embeds: [embed], components: [buttons] };
}

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("transacoes")
    .setDescription("Consulte seu histórico ou o histórico global do servidor")
    .addBooleanOption(option =>
      option.setName("servidor")
        .setDescription("Ver o histórico de todas as transações do servidor?")
        .setRequired(false)
    ),

  async execute(interaction) {
    const global = interaction.options.getBoolean("servidor") ?? false;
    await interaction.deferReply();
    return interaction.editReply({ ...buildPage(interaction, 0, global), allowedMentions: { parse: [] } });
  },

  async handleButton(interaction) {
    const isGlobal = interaction.customId.endsWith("|global");
    const baseId = isGlobal ? interaction.customId.slice(0, -7) : interaction.customId;

    const button = parseHistoryButtonId(baseId);
    if (!button) {
      return interaction.reply({ content: "Esta interação expirou. Por favor, utilize o comando `/transacoes` novamente.", flags: 64 });
    }
    if (interaction.user.id !== button.ownerId) {
      return interaction.reply({ content: "Este histórico foi solicitado por outro usuário.", flags: 64 });
    }
    await interaction.deferUpdate();
    return interaction.editReply({ ...buildPage(interaction, targetPage(button), isGlobal), allowedMentions: { parse: [] } });
  },
});