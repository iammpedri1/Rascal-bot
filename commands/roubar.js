const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} = require("discord.js");

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
      .setEmoji(emoji.pepeReeeee)
      .setLabel("Roubar de volta")
      .setStyle(ButtonStyle.Danger)
  );
}

function replyPayload(interaction, target, result) {
  const payload = {
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

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("roubar")
    .setDescription("Tente roubar cookies de outro usuário a cada 1 hora")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário que você quer roubar")
        .setRequired(true)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser("usuario");

    if (target.bot) {
      return interaction.reply(blocked("Você não pode roubar bots!"));
    }

    const result = rob(interaction.user, target, buildContext(interaction));

    if (!result.ok && result.reason === "self") {
      return interaction.reply(blocked("Você não pode roubar você mesmo!"));
    }

    if (!result.ok && result.reason === "target_balance") {
      return interaction.reply(blocked("O membro escolhido não tem saldo suficiente para ser roubado!"));
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
      return interaction.reply(blocked("Esse botao e para quem foi roubado!"));
    }

    const target = await interaction.client.users.fetch(robberId);
    const result = rob(interaction.user, target, buildContext(interaction));

    if (!result.ok && result.reason === "cooldown") {
      return interaction.reply(cooldown(result));
    }

    if (!result.ok && result.reason === "target_balance") {
      return interaction.reply(blocked("O membro escolhido não tem saldo suficiente para ser roubado!"));
    }

    if (!result.ok) {
      return interaction.reply(blocked("Não foi possível roubar agora!"));
    }

    return interaction.reply(replyPayload(interaction, target, result));
  },
};
