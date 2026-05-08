const { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");

const MAX_DELETE = 100;

module.exports = {
  category: "staff",

  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Limpa mensagens do canal")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const fetched = await interaction.channel.messages.fetch({ limit: MAX_DELETE });
      const messages = target
        ? fetched.filter(message => message.author.id === target.id).first(amount)
        : fetched.first(amount);

      if (!messages.length) {
        return interaction.editReply(`${emoji.peepSad} Não encontrei mensagens para apagar.`);
      }

      const deleted = await interaction.channel.bulkDelete(messages, true);
      const skipped = messages.length - deleted.size;
      const targetText = target ? ` de ${target}` : "";
      const skippedText = skipped
        ? `\n${emoji.sino} ${skipped} mensagem(ns) não puderam ser apagadas por serem antigas demais.`
        : "";

      return interaction.editReply(
        `${emoji.correct} Apaguei **${deleted.size}** mensagem(ns)${targetText}.${skippedText}`
      );
    } catch (error) {
      console.error("Erro no /clear:", error);
      return interaction.editReply(`${emoji.crossed} Não consegui limpar as mensagens desse canal.`);
    }
  },
};
