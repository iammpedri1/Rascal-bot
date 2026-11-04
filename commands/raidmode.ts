import { defineCommand } from "../types/command";
const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");
const { activateRaidLockdown, disableRaidLockdown } = require("../utils/raidLockdown");
const { getRaidMode, isRaidModeEnabled } = require("../utils/raidMode");
const { ACCESS_LEVELS } = require("../utils/permissions");

function isStaff(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) || false;
}

module.exports = defineCommand({
  category: "staff",
  access: { level: ACCESS_LEVELS.MODERATOR, permission: PermissionFlagsBits.ManageGuild },
  data: new SlashCommandBuilder()
    .setName("raidmode")
    .setDescription("Gerencia o estado de bloqueio de segurança (lockdown) do servidor")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option => option
      .setName("acao")
      .setDescription("Ação do sistema de segurança")
      .setRequired(true)
      .addChoices(
        { name: "Ativar", value: "ativar" },
        { name: "Desativar", value: "desativar" },
        { name: "Status", value: "status" },
      ))
    .addStringOption(option => option
      .setName("motivo")
      .setDescription("Razão da ativação manual")
      .setMaxLength(300)
      .setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: "Este comando deve ser utilizado dentro de um servidor.", flags: 64 });
    if (!isStaff(interaction)) return interaction.reply({ content: "Apenas membros da equipe de moderação podem controlar o estado de segurança.", flags: 64 });

    const action = interaction.options.getString("acao", true);
    if (action === "status") {
      const active = isRaidModeEnabled(interaction.guildId);
      const state = getRaidMode(interaction.guildId);
      return interaction.reply({
        content: active
          ? `🚨 Estado de bloqueio ativo desde <t:${Math.floor((state?.enabledAt || Date.now()) / 1000)}:R>. Motivo: ${state?.reason || "Não informado"}.`
          : "✅ Sistema de segurança operando em modo normal.",
        flags: 64,
      });
    }

    await interaction.deferReply({ flags: 64 });
    try {
      if (action === "desativar") {
        const result = await disableRaidLockdown(interaction.guild, interaction.user.tag);
        const embed = new EmbedBuilder()
          .setColor(result.failed.length ? 0xe67e22 : 0x57f287)
          .setTitle(result.failed.length ? "⚠️ Restauração parcial" : "✅ Lockdown desativado")
          .setDescription(result.inactive
            ? "Não havia um lockdown persistido para restaurar."
            : `Permissões restauradas em **${result.restored}** canais.${result.failed.length ? `\n\n**Falhas:** ${result.failed.length}. Rode /raidmode desativar novamente após corrigir as permissões do bot.` : "\nA configuração anterior de cada canal foi preservada."}`)
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      const reason = interaction.options.getString("motivo") || "Ativação manual pela staff";
      const result = await activateRaidLockdown(interaction.guild, {
        activatedBy: interaction.user.id,
        reason,
      });
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(result.alreadyActive ? "🚨 Lockdown já estava ativo" : "🚨 Lockdown anti-raid ativado")
        .setDescription(result.alreadyActive
          ? "A contenção já está ativa. Use `/raidmode status` para consultar o estado."
          : `**Motivo:** ${reason}\n**Canais protegidos:** ${result.locked}${result.failed.length ? `\n**Falhas:** ${result.failed.length}. Confira o log da staff.` : ""}\nConvites novos foram bloqueados; convites existentes continuam válidos.`)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Falha ao controlar lockdown anti-raid", error);
      return interaction.editReply({ content: "Não consegui aplicar essa ação por completo. Confira permissões e logs do bot." });
    }
  },
});
