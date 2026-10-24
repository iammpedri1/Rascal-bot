import { defineCommand } from "../types/command";
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");
const emoji = require("../utils/emojis");
const { transfer } = require("../utils/cookieEconomy");
const { buildInlineErrorEmbed } = require("../utils/cookieViews");

function formatCookies(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR");
}

module.exports = defineCommand({
  category: "economy",
  data: new SlashCommandBuilder()
    .setName("transferir")
    .setDescription("Transfere cookies para outro membro")
    .setDMPermission(false)
    .addUserOption(option => option
      .setName("usuario")
      .setDescription("Membro que receberá os cookies")
      .setRequired(true))
    .addIntegerOption(option => option
      .setName("quantidade")
      .setDescription("Quantidade de cookies para transferir")
      .setRequired(true)
      .setMinValue(1)),

  async execute(interaction) {
    const target = interaction.options.getUser("usuario", true);
    const quantity = interaction.options.getInteger("quantidade", true);
    if (target.bot) {
      return interaction.reply({ embeds: [buildInlineErrorEmbed("Cookies só podem ser enviados para outro membro.")], flags: 64 });
    }

    try {
      const result = transfer(interaction.user, target, quantity, {
        guildId: interaction.guildId,
        guildName: interaction.guild?.name,
      });
      if (!result.ok) {
        const message = result.reason === "self"
          ? "Você não pode transferir cookies para si mesmo."
          : result.reason === "amount"
            ? "Informe uma quantidade inteira maior que zero."
            : `Saldo insuficiente para transferir **${formatCookies(quantity)} cookies**.`;
        return interaction.reply({ embeds: [buildInlineErrorEmbed(message)], flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`${emoji.greenTick} Transferência concluída`)
        .setDescription(`${interaction.user} enviou ${emoji.cookie} **${formatCookies(result.amount)} cookies** para ${target}.`)
        .addFields(
          { name: "Seu saldo", value: `${emoji.cookie} **${formatCookies(result.from.balance)}**`, inline: true },
          { name: `Saldo de ${target.username}`, value: `${emoji.cookie} **${formatCookies(result.to.balance)}**`, inline: true },
        )
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Falha ao transferir cookies", error);
      return interaction.reply({ embeds: [buildInlineErrorEmbed("Não consegui concluir a transferência. Nenhum débito parcial foi mantido.")], flags: 64 });
    }
  },
});
