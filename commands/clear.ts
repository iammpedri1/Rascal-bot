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
    .setDescription("Ferramentas administrativas para limpeza de mensagens")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(subcommand =>
      subcommand
        .setName("chat")
        .setDescription("Remove um volume específico de mensagens no canal atual")
        .addIntegerOption(option =>
          option
            .setName("quantidade")
            .setDescription("Quantidade de mensagens para remoção (1 a 100)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_DELETE)
        )
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Filtra e remove apenas mensagens de um usuário específico")
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: `${emoji.crossed} Este comando é restrito para uso em servidores.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: `${emoji.crossed} Acesso restrito a membros da equipe administrativa.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(interaction.channel?.type)) {
      return interaction.reply({
        content: `${emoji.crossed} Este tipo de canal não suporta operações de limpeza em massa.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const me = interaction.guild.members.me;
    if (!me?.permissionsIn(interaction.channel).has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: `${emoji.crossed} Eu preciso da permissão **Gerenciar mensagens** neste canal para prosseguir.`,
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
        resultMessage = `${emoji.peepSad} Nenhuma mensagem encontrada para remoção com os critérios informados.`;
      } else {
        const deleted = await interaction.channel.bulkDelete(messages, true);
        const skipped = messages.length - deleted.size;
        const targetText = target ? ` de ${target}` : "";
        const skippedText = skipped
          ? `\n${emoji.sino} ${skipped} mensagem(ns) permanecem no canal devido à política de retenção do Discord (mais de 14 dias).`
          : "";
        resultMessage = `${emoji.correct} Foram removidas **${deleted.size}** mensagem(ns)${targetText} com sucesso.${skippedText}`;
      }
    } catch (error) {
      if (discordErrorCode(error) !== 10008) console.error("Erro no /clear chat:", error);
      resultMessage = discordErrorCode(error) === 10008
        ? `${emoji.sino} A lista de mensagens foi alterada durante a operação. Por favor, tente novamente.`
        : `${emoji.crossed} Não foi possível concluir a limpeza das mensagens neste canal.`;
    }

    return sendClearResult(interaction, resultMessage);
  },
});
