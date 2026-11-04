import { defineCommand } from "../types/command";
const { EmbedBuilder, MessageFlags, SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");
const { randomColor } = require("../utils/embedStyle") as { randomColor(): number };
const blackMarket = require("../utils/blackMarket") as typeof import("../utils/blackMarket");
const emoji = require("../utils/emojis") as typeof import("../utils/emojis");

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("fianca")
    .setDescription("Efetue o pagamento da fiança para liberação imediata da detenção"),

  async execute(interaction) {
    const result = blackMarket.payBail(interaction.user);
    const embed = new EmbedBuilder().setColor(randomColor());

    if (result.ok === true) {
      embed
        .setTitle(`${emoji.application("correct", "✅")} Fiança Liquidada`)
        .setDescription(`Sua liberdade foi concedida. Saldo atualizado: **${result.balance.toLocaleString("pt-BR")} cookies**.`);
    } else if (result.reason === "balance") {
      embed
        .setTitle(`${emoji.application("pand_police", "🚓")} Saldo Insuficiente`)
        .setDescription(`O valor da fiança é de **${Number(result.bailAmount).toLocaleString("pt-BR")} cookies**. Caso prefira, você pode aguardar o término do período de detenção.`);
    } else {
      embed
        .setTitle(`${emoji.application("correct", "✅")} Situação Regular`)
        .setDescription("Você não possui restrições de liberdade no momento.");
    }

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
});
