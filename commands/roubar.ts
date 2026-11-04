import { defineCommand, type CommandChatInputInteraction } from "../types/command";
import { EmbedBuilder, SlashCommandBuilder, type User } from "discord.js";

const emoji = require("../utils/emojis") as typeof import("../utils/emojis");
const { rob } = require("../utils/cookieEconomy") as {
  rob(thiefUser: User, targetUser: User, details?: Record<string, unknown>): RobResult;
};
const { buildContext, buildInlineCooldownEmbed } = require("../utils/cookieViews") as {
  buildContext(interaction: CommandChatInputInteraction): Record<string, unknown>;
  buildInlineCooldownEmbed(result: any, commandLabel?: string): any;
};

interface RobResult {
  ok: boolean;
  reason?: "self" | "target_balance" | "cooldown";
  success?: boolean;
  thief?: { balance: number };
  target?: { balance: number };
  stolen?: number;
  percent?: number;
  penalty?: number;
  remaining?: number;
  nextAt?: number;
}


const PEPE_POLICE_GIF = "https://media.tenor.com/PLACEHOLDER_POLICE/pepe-policial-cassetete.gif"; // Pepe policial com cassetete
const PEPE_THIEF_GIF = "https://media.tenor.com/PLACEHOLDER_THIEF/pepe-ladrao.gif"; // Pepe ladrão (sucesso)

function amount(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR");
}

function buildSuccessEmbed(thief: User, target: User, result: RobResult): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("💰 » ROUBO BEM-SUCEDIDO")
    .setThumbnail(PEPE_THIEF_GIF)
    .setDescription(
      [
        `${emoji.application("pand_happy", "🎉")} \u00bb <@${thief.id}> roubou **${result.percent}%** (${amount(result.stolen ?? 0)} cookies) de <@${target.id}>!`,
        `${emoji.application("cookie", "🍪")} \u00bb Novo saldo: **${amount(result.thief?.balance ?? 0)} cookies**.`,
      ].join("\n"),
    );
}

function buildFailureEmbed(thief: User, target: User, result: RobResult): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("🚨 » TENTATIVA DE ROUBO FRUSTRADA")
    .setThumbnail(PEPE_POLICE_GIF)
    .setDescription(
      [
        `🚨 » <@${thief.id}> tentou roubar <@${target.id}> e acabou sendo pego pela polícia perdendo ${amount(result.penalty ?? 0)} moedas!`,
        `${emoji.application("cookie", "🍪")} \u00bb Saldo atual: **${amount(result.thief?.balance ?? 0)} cookies**.`,
      ].join("\n"),
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
    .setName("roubar")
    .setDescription("Tente roubar cookies de outro usuário a cada 3 horas")
    .addUserOption((option) => option
      .setName("usuario")
      .setDescription("Usuário que você quer roubar")
      .setRequired(true)),

  async execute(interaction: CommandChatInputInteraction): Promise<void> {
    const target = interaction.options.getUser("usuario", true);

    if (target.bot) {
      await interaction.reply({ embeds: [inlineError("Você não pode roubar bots!")], flags: 64 });
      return;
    }

    const result = rob(interaction.user, target, buildContext(interaction));

    if (!result.ok && result.reason === "self") {
      await interaction.reply({ embeds: [inlineError("Você não pode roubar a si mesmo!")], flags: 64 });
      return;
    }

    if (!result.ok && result.reason === "target_balance") {
      await interaction.reply({ embeds: [inlineError("O membro escolhido não tem saldo suficiente para ser roubado!")], flags: 64 });
      return;
    }

    if (!result.ok && result.reason === "cooldown") {
      await interaction.reply({
            embeds: [buildInlineCooldownEmbed(result, "/roubar")],
        flags: 64,
      });
      return;
    }

    const embed = result.success
      ? buildSuccessEmbed(interaction.user, target, result)
      : buildFailureEmbed(interaction.user, target, result);

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
});
