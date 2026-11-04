import { defineCommand, type CommandChatInputInteraction } from "../types/command";
import { EmbedBuilder, SlashCommandBuilder, type User } from "discord.js";

const emoji = require("../utils/emojis") as typeof import("../utils/emojis");
const { transfer } = require("../utils/cookieEconomy") as {
  transfer(
    fromUser: User,
    toUser: User,
    amount: number,
    details?: Record<string, unknown>,
  ): TransferResult;
};

interface TransferResult {
  ok: boolean;
  reason?: "self" | "amount" | "balance";
  amount?: number;
  from?: { balance: number };
  to?: { balance: number };
  tax?: number;
}

function amount(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR");
}

function buildPixEmbed(sender: User, target: User, result: TransferResult): EmbedBuilder {
  const taxLine = result.tax
    ? `${emoji.application("coin", "🪙")} » Imposto progressivo: **${amount(result.tax)} cookies**.`
    : null;
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("💠 » PIX enviado!")
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .setDescription(
      [
        `${emoji.application("cookie", "🍪")} \u00bb <@${sender.id}> enviou **${amount(result.amount ?? 0)} cookies** para <@${target.id}> via PIX.`,
        `${emoji.application("cookie", "🍪")} \u00bb Seu saldo: **${amount(result.from?.balance ?? 0)} cookies**.`,
        `${emoji.application("cookie", "🍪")} \u00bb Saldo de ${target.username}: **${amount(result.to?.balance ?? 0)} cookies**.`,
        taxLine,
      ].filter(Boolean).join("\n"),
    );
}

function inlineError(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setDescription(`${emoji.application("crossed", "❌")} \u00bb ${message}`);
}

module.exports = defineCommand({
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("pix")
    .setDescription("Envie cookies para outro membro via PIX")
    .setDMPermission(false)
    .addUserOption((option) => option
      .setName("usuario")
      .setDescription("Membro que receberá os cookies")
      .setRequired(true))
    .addIntegerOption((option) => option
      .setName("quantidade")
      .setDescription("Quantidade de cookies para enviar")
      .setRequired(true)
      .setMinValue(1)),

  async execute(interaction: CommandChatInputInteraction): Promise<void> {
    const target = interaction.options.getUser("usuario", true);
    const quantity = interaction.options.getInteger("quantidade", true);

    if (target.bot) {
      await interaction.reply({ embeds: [inlineError("Cookies só podem ser enviados para outro membro.")], flags: 64 });
      return;
    }

    try {
      const result = transfer(interaction.user, target, quantity, {
        guildId: interaction.guildId,
        guildName: interaction.guild?.name,
      });

      if (!result.ok) {
        const message = result.reason === "self"
          ? "Você não pode enviar PIX para si mesmo."
          : result.reason === "amount"
            ? "Informe uma quantidade inteira maior que zero."
            : `Saldo insuficiente para enviar **${amount(quantity)} cookies**.`;
        await interaction.reply({ embeds: [inlineError(message)], flags: 64 });
        return;
      }

      await interaction.reply({
        embeds: [buildPixEmbed(interaction.user, target, result)],
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.error("Falha ao enviar PIX", error);
      await interaction.reply({ embeds: [inlineError("Não consegui concluir o PIX. Nenhum débito parcial foi mantido.")], flags: 64 });
    }
  },
});
