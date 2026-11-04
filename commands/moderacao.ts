import { defineCommand } from "../types/command";
const {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");

const db = require("../utils/db");
const emoji = require("../utils/emojis");

function getGuildSettings(guildId) {
  return db.prepare("SELECT * FROM moderation_guild_settings WHERE guild_id = ?").get(String(guildId));
}

async function configureGuild(interaction) {
  const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  if (!canManage) {
    return interaction.reply({
      content: "A configuração de moderação exige a permissão de **Gerenciar Servidor**.",
      flags: 64,
    });
  }

  const channel = interaction.options.getChannel("canal_logs");
  const removeChannel = interaction.options.getBoolean("remover_canal") || false;

  if (channel && removeChannel) {
    return interaction.reply({ content: "Por favor, selecione apenas uma opção: definir um novo canal ou optar pela remoção (`remover_canal`).", flags: 64 });
  }
  if (!channel && !removeChannel) {
    return interaction.reply({
      content: "É necessário especificar um canal de registros ou utilizar a opção `remover_canal` para restaurar o padrão.",
      flags: 64,
    });
  }

  const channelId = removeChannel ? null : channel.id;

  db.prepare(`
    INSERT INTO moderation_guild_settings (
      guild_id, log_channel_id, updated_by, updated_at
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      log_channel_id = excluded.log_channel_id,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).run(
    interaction.guildId,
    channelId,
    interaction.user.id,
    Date.now(),
  );

  const details = [];
  if (channel) details.push(`Canal de registros: ${channel}`);
  if (removeChannel) details.push("Configuração de canal removida; os registros serão exibidos no canal onde o comando for executado.");
  details.push("As ilustrações das sanções disciplinares são gerenciadas automaticamente pelo sistema.");

  return interaction.reply({
    content: `${emoji.correct} Configurações de moderação atualizadas com sucesso.\n${details.join("\n")}`,
    flags: 64,
  });
}

module.exports = defineCommand({
  category: "staff",

  data: new SlashCommandBuilder()
    .setName("moderacao")
    .setDescription("Gerencia as configurações de moderação do servidor")
    .setDMPermission(false)
    .addSubcommand(subcommand =>
      subcommand
        .setName("configurar")
        .setDescription("Define o canal destinado ao registro de sanções disciplinares")
        .addChannelOption(option =>
          option
            .setName("canal_logs")
            .setDescription("Canal onde os registros de punição serão publicados")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option.setName("remover_canal").setDescription("Restaura a publicação dos registros para o canal de origem do comando")
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Este comando deve ser utilizado dentro de um servidor.", flags: 64 });
    }

    return configureGuild(interaction);
  },
});
