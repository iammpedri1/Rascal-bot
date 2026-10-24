import { defineCommand } from "../types/command";
const { EmbedBuilder, MessageFlags, SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");
const { randomColor } = require("../utils/embedStyle") as { randomColor(): number };
const blackMarket = require("../utils/blackMarket") as typeof import("../utils/blackMarket");
const emoji = require("../utils/emojis") as typeof import("../utils/emojis");

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("fianca")
    .setDescription("Pague sua fiança e saia da prisão do Mercado Negro"),

  async execute(interaction) {
    const result = blackMarket.payBail(interaction.user);
    const embed = new EmbedBuilder().setColor(randomColor());

    if (result.ok === true) {
      embed
        .setTitle(`${emoji.application("correct", "✅")} Fiança paga`)
        .setDescription(`Você está livre. Saldo atual: **${result.balance.toLocaleString("pt-BR")} cookies**.`);
    } else if (result.reason === "balance") {
      embed
        .setTitle(`${emoji.application("pand_police", "🚓")} Saldo insuficiente`)
        .setDescription(`Sua fiança é de **${Number(result.bailAmount).toLocaleString("pt-BR")} cookies**. Você também pode aguardar o fim da prisão.`);
    } else {
      embed
        .setTitle(`${emoji.application("correct", "✅")} Você está livre`)
        .setDescription("Você não está na prisão do Mercado Negro.");
    }

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
});
