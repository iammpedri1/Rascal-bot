import { defineCommand } from "../types/command";
// @ts-nocheck
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");

const { rob } = require("../utils/cookieEconomy");
const emoji = require("../utils/emojis");
const {
  buildContext,
  buildInlineCooldownEmbed,
  buildInlineErrorEmbed,
  buildRobEmbed,
} = require("../utils/cookieViews");

function buildRevengeButton(robberId, victimId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`roubar|revenge|${robberId}|${victimId}`)
      .setEmoji(emoji.toComponentEmoji(emoji.pepeReeeee))
      .setLabel("Retaliação")
      .setStyle(ButtonStyle.Danger)
  );
}

function replyPayload(interaction, target, result) {
  const payload: { embeds: unknown[]; components?: unknown[] } = {
    embeds: [buildRobEmbed(interaction, target, result)],
  };

  if (result.success) {
    payload.components = [buildRevengeButton(interaction.user.id, target.id)];
  }

  return payload;
}

function blocked(message) {
  return {
    embeds: [buildInlineErrorEmbed(message)],
    flags: 64,
  };
}

function cooldown(result) {
  return {
    embeds: [buildInlineCooldownEmbed(result, "/roubar")],
    flags: 64,
  };
}

module.exports = defineCommand({
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("roubar")
    .setDescription("Tente subtrair cookies de outro membro (sujeito a penalidades)")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário que será o alvo da ação")
        .setRequired(true)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser("usuario");

    if (target.bot) {
      return interaction.reply(blocked("Não é possível realizar esta ação contra perfis robóticos."));
    }

    const result = rob(interaction.user, target, buildContext(interaction));

    if (!result.ok && result.reason === "self") {
      return interaction.reply(blocked("Você não pode realizar esta ação contra o próprio perfil."));
    }

    if (!result.ok && result.reason === "prison") {
      return interaction.reply(blocked(`Você encontra-se em detenção até <t:${Math.floor(result.prison.releaseAt / 1000)}:R>. Utilize /fianca para solicitar a liberação.`));
    }

    if (!result.ok && result.reason === "target_balance") {
      return interaction.reply(blocked("O alvo selecionado não possui cookies suficientes para esta operação."));
    }

    if (!result.ok && result.reason === "cooldown") {
      return interaction.reply(cooldown(result));
    }

    return interaction.reply(replyPayload(interaction, target, result));
  },

  async handleButton(interaction) {
    const [, action, robberId, victimId] = interaction.customId.split("|");
    if (action !== "revenge") return;

    if (interaction.user.id !== victimId) {
      return interaction.reply(blocked("Este botão é restrito à vítima da ação original."));
    }

    const target = await interaction.client.users.fetch(robberId);
    const result = rob(interaction.user, target, buildContext(interaction));

    if (!result.ok && result.reason === "cooldown") {
      return interaction.reply(cooldown(result));
    }

    if (!result.ok && result.reason === "target_balance") {
      return interaction.reply(blocked("O alvo selecionado não possui cookies suficientes para esta operação."));
    }

    if (!result.ok) {
      return interaction.reply(blocked("Não foi possível processar a retaliação no momento."));
    }

    return interaction.reply(replyPayload(interaction, target, result));
  },
});
