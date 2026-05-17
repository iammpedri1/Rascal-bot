const {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");

const emoji = require("../utils/emojis");
const {
  applyCommunityStructure,
  parseLevelRoleRewards,
  syncGuildLevelRoles,
} = require("../utils/communityManager");

function assertManager(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function rewardsText(guild) {
  const rewards = parseLevelRoleRewards(guild);

  if (!rewards.length) {
    return "Nenhum cargo de level encontrado. Crie cargos como `Level 5`, `Level 10`, `Nível 20`, ou configure `LEVEL_ROLE_REWARDS=5:idDoCargo,10:idDoCargo` no `.env`.";
  }

  return rewards.map(item => `Level ${item.level}: ${item.role}`).join("\n");
}

module.exports = {
  category: "staff",

  data: new SlashCommandBuilder()
    .setName("comunidade")
    .setDescription("Organiza canais e cargos da comunidade sem resetar o servidor")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName("canais")
        .setDescription("Cria/atualiza canais base e permissões usando cargos existentes")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("cargos")
        .setDescription("Mostra cargos automáticos por level encontrados no servidor")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("sincronizar")
        .setDescription("Sincroniza os cargos de level com o XP atual")
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use esse comando em um servidor.", flags: 64 });
    }

    if (!assertManager(interaction)) {
      return interaction.reply({
        content: `${emoji.crossed} Você precisa de permissão para gerenciar o servidor.`,
        flags: 64,
      });
    }

    const me = interaction.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageChannels) ||
      !me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: `${emoji.crossed} Eu preciso das permissões **Gerenciar canais** e **Gerenciar cargos**.`,
        flags: 64,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: 64 });

    if (subcommand === "canais") {
      const result = await applyCommunityStructure(interaction.guild);
      const roleLines = [
        `Admin: ${result.roles.admin || "não encontrado"}`,
        `Mod/Staff: ${result.roles.mod || "não encontrado"}`,
        `Membro: ${result.roles.member || "não encontrado"}`,
        `Visitante: ${result.roles.visitor || "não encontrado"}`,
      ];

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("Comunidade atualizada")
        .setDescription(result.log.join("\n").slice(0, 3500) || "Nenhuma alteração necessária.")
        .addFields({ name: "Cargos usados", value: roleLines.join("\n") })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === "cargos") {
      const embed = new EmbedBuilder()
        .setColor(0xff6a00)
        .setTitle("Cargos automáticos por level")
        .setDescription(rewardsText(interaction.guild))
        .setFooter({ text: "Modo padrão: mantém só o maior cargo de level elegível." });

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === "sincronizar") {
      const result = await syncGuildLevelRoles(interaction.guild);

      return interaction.editReply({
        content: [
          `${emoji.correct} Sincronização concluída.`,
          `Cargos de level encontrados: **${result.rewards}**`,
          `Membros verificados: **${result.checked}**`,
          `Membros alterados: **${result.changed}**`,
        ].join("\n"),
      });
    }

    return interaction.editReply({ content: "Subcomando desconhecido." });
  },
};
