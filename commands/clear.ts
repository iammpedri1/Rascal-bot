import { defineCommand } from "../types/command";
const {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");

const emoji = require("../utils/emojis");
const { ACCESS_LEVELS } = require("../utils/permissions");

const MAX_DELETE = 100;

function discordErrorCode(error) {
  return typeof error?.code === "number" ? error.code : undefined;
}

function scheduleReplyDeletion(interaction, messageId = "@original") {
  const timer = setTimeout(() => {
    void interaction.deleteReply(messageId).catch(error => {
      if (![10008, 10015, 10062].includes(discordErrorCode(error))) {
        console.error("Erro ao remover resposta temporária do /clear:", error);
      }
    });
  }, 5000);
  timer.unref?.();
}

async function sendClearResult(interaction, content) {
  try {
    await interaction.editReply(content);
    scheduleReplyDeletion(interaction);
  } catch (error) {
    if (discordErrorCode(error) !== 10008) throw error;

    const fallback = await interaction.followUp({
      content,
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
    });
    scheduleReplyDeletion(interaction, fallback.id);
  }
}

module.exports = defineCommand({
  category: "staff",
  access: { level: ACCESS_LEVELS.MODERATOR, permission: PermissionFlagsBits.ManageMessages },

  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Ferramentas de limpeza da staff")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(subcommand =>
      subcommand
        .setName("chat")
        .setDescription("Apaga mensagens do canal atual")
        .addIntegerOption(option =>
          option
            .setName("quantidade")
            .setDescription("Quantidade de mensagens para apagar, de 1 a 100")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_DELETE)
        )
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Apaga apenas mensagens desse usuário")
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: `${emoji.crossed} Use esse comando em um servidor.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: `${emoji.crossed} Apenas a staff pode usar esse comando.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(interaction.channel?.type)) {
      return interaction.reply({
        content: `${emoji.crossed} Esse canal não permite limpeza de mensagens.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const me = interaction.guild.members.me;
    if (!me?.permissionsIn(interaction.channel).has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: `${emoji.crossed} Eu preciso da permissão **Gerenciar mensagens** nesse canal.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const amount = interaction.options.getInteger("quantidade", true);
    const target = interaction.options.getUser("usuario");

    await interaction.deferReply();

    let resultMessage;
    try {
      const fetched = await interaction.channel.messages.fetch({ limit: MAX_DELETE });
      const messages = target
        ? fetched.filter(message => message.author.id === target.id).first(amount)
        : fetched.first(amount);

      if (!messages.length) {
        resultMessage = `${emoji.peepSad} Não encontrei mensagens para apagar.`;
      } else {
        const deleted = await interaction.channel.bulkDelete(messages, true);
        const skipped = messages.length - deleted.size;
        const targetText = target ? ` de ${target}` : "";
        const skippedText = skipped
          ? `\n${emoji.sino} ${skipped} mensagem(ns) não puderam ser apagadas por serem antigas demais.`
          : "";
        resultMessage = `${emoji.correct} Apaguei **${deleted.size}** mensagem(ns)${targetText}.${skippedText}`;
      }
    } catch (error) {
      if (discordErrorCode(error) !== 10008) console.error("Erro no /clear chat:", error);
      resultMessage = discordErrorCode(error) === 10008
        ? `${emoji.sino} A lista de mensagens mudou durante a limpeza. Tente novamente.`
        : `${emoji.crossed} Não consegui limpar as mensagens desse canal.`;
    }

    return sendClearResult(interaction, resultMessage);
  },
});
