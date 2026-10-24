import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type Guild,
  type User,
} from "discord.js";
import type { CommandChatInputInteraction } from "../types/command";
import { defineCommand } from "../types/command";
const db = require("../utils/db");
const emoji = require("../utils/emojis");
const { isPrimaryGuild } = require("../utils/primaryGuild");

const PAGE_SIZE = 5;
interface PunishmentSummary { action: string; total: number; }
interface PunishmentCase {
  id: number;
  moderator_id: string;
  moderator_username: string;
  action: string;
  reason: string;
  duration_ms: number | null;
  issued_at: number;
}
const ACTION_NAMES: Record<string, string> = {
  aviso: "Advertência",
  aviso_automod: "Advertência automática",
  aviso_ia: "Advertência por imagem",
  mute: "Mute",
  castigo: "Castigo",
  expulsar: "Expulsão",
  banir: "Banimento",
};

function isStaff(interaction: CommandChatInputInteraction): boolean {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) return true;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) return true;
  const member = interaction.member;
  if (!member) return false;
  const configuredStaffRoles = String(process.env.STAFF_ROLE_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
  if (Array.isArray(member.roles)) return member.roles.some(roleId => configuredStaffRoles.includes(roleId));
  return member.roles.cache.some(role =>
    configuredStaffRoles.includes(role.id) ||
    ["admin", "administrador", "mod", "moderador", "staff", "equipe"].includes(role.name.toLowerCase())
  );
}

function getSummary(guildId: string, userId: string): PunishmentSummary[] {
  return db.prepare(`
    SELECT action, COUNT(*) AS total
    FROM moderation_punishments
    WHERE guild_id = ? AND target_id = ? AND status IN ('applied', 'applied_log_failed')
    GROUP BY action
  `).all(String(guildId), String(userId)) as PunishmentSummary[];
}

function getCases(guildId: string, userId: string, offset: number): PunishmentCase[] {
  return db.prepare(`
    SELECT id, moderator_id, moderator_username, action, reason, duration_ms, issued_at
    FROM moderation_punishments
    WHERE guild_id = ? AND target_id = ? AND status IN ('applied', 'applied_log_failed')
    ORDER BY issued_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(String(guildId), String(userId), PAGE_SIZE, offset) as PunishmentCase[];
}

function buildEmbed(guild: Guild, target: User, summary: PunishmentSummary[], rows: PunishmentCase[], total: number, page: number) {
  const totals = new Map<string, number>(summary.map(row => [row.action, Number(row.total)]));
  const warnings = [...totals.entries()].filter(([action]) => action.startsWith("aviso")).reduce((sum, [, count]) => sum + count, 0);
  const mutes = (totals.get("mute") || 0) + (totals.get("castigo") || 0);
  const kicks = totals.get("expulsar") || 0;
  const bans = totals.get("banir") || 0;
  const lines = rows.map(row => {
    const action = ACTION_NAMES[row.action] || row.action;
    const at = Math.floor(Number(row.issued_at) / 1000);
    const reason = String(row.reason || "Sem motivo informado").replace(/\s+/g, " ").slice(0, 220);
    const duration = row.duration_ms ? ` · ${Math.ceil(Number(row.duration_ms) / 60000)} min` : "";
    return `${emoji.clipboard} **#${row.id} · ${action}**${duration}\n└ <t:${at}:d> · <@${row.moderator_id}>\n└ ${reason}`;
  });

  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setAuthor({ name: `Ficha de moderação · ${target.globalName || target.username}`, iconURL: target.displayAvatarURL({ size: 128 }) })
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .setDescription([
      `${emoji.humanIcon} **Membro:** ${target} · \`${target.id}\``,
      `${emoji.staff} **Avisos:** ${warnings} · ${emoji.sino} **Mutes/castigos:** ${mutes} · ${emoji.policePanda} **Expulsões:** ${kicks} · ${emoji.blobBan} **Banimentos:** ${bans}`,
      "",
      total ? `### Registros recentes (${total})\n${lines.join("\n\n")}` : "Nenhum caso aplicado foi encontrado para este membro.",
    ].join("\n"))
    .setFooter({ text: `${guild.name} · Página ${page + 1} de ${Math.max(1, Math.ceil(total / PAGE_SIZE))}` })
    .setTimestamp();
}

function buildComponents(page: number, totalPages: number, disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  const previous = new ButtonBuilder()
    .setCustomId("ficha:previous")
    .setLabel("Anterior")
    .setEmoji({ name: "◀️" })
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || page <= 0);
  const next = new ButtonBuilder()
    .setCustomId("ficha:next")
    .setLabel("Próxima")
    .setEmoji({ name: "▶️" })
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled || page >= totalPages - 1);
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(previous, next)];
}

module.exports = defineCommand({
  category: "staff",
  data: new SlashCommandBuilder()
    .setName("ficha")
    .setDescription("Consulta o histórico de moderação de um membro")
    .setDMPermission(false)
    .addUserOption(option => option.setName("usuario").setDescription("Membro cuja ficha será consultada").setRequired(true)),

  async execute(interaction: CommandChatInputInteraction) {
    if (!interaction.guild || !isPrimaryGuild(interaction.guildId)) {
      return interaction.reply({ content: "Este comando está disponível apenas no servidor principal.", flags: 64 });
    }
    if (!isStaff(interaction)) {
      return interaction.reply({ content: "A ficha de moderação é restrita à equipe de moderação.", flags: 64 });
    }

    const target = interaction.options.getUser("usuario", true);
    try {
      const count = Number(db.prepare(`
        SELECT COUNT(*) AS total FROM moderation_punishments
        WHERE guild_id = ? AND target_id = ? AND status IN ('applied', 'applied_log_failed')
      `).get(interaction.guildId, target.id).total);
      const summary = getSummary(interaction.guildId, target.id);
      const page = 0;
      const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
      await interaction.reply({
        embeds: [buildEmbed(interaction.guild, target, summary, getCases(interaction.guildId, target.id, 0), count, page)],
        components: buildComponents(page, totalPages),
        flags: 64,
      });

      const message = await interaction.fetchReply();
      const collector = message.createMessageComponentCollector({ time: 90_000 });
      let currentPage = 0;
      collector.on("collect", async buttonInteraction => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          return buttonInteraction.reply({ content: "Esta ficha foi aberta por outra pessoa.", flags: 64 });
        }
        await buttonInteraction.deferUpdate();
        currentPage = Math.max(0, Math.min(totalPages - 1, currentPage + (buttonInteraction.customId === "ficha:next" ? 1 : -1)));
        await buttonInteraction.editReply({
          embeds: [buildEmbed(interaction.guild, target, summary, getCases(interaction.guildId, target.id, currentPage * PAGE_SIZE), count, currentPage)],
          components: buildComponents(currentPage, totalPages),
        });
      });
      collector.on("end", async () => {
        await message.edit({ components: buildComponents(currentPage, totalPages, true) }).catch(() => null);
      });
    } catch (error) {
      console.error("Falha ao consultar ficha de moderação", error);
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ content: "Não consegui consultar a ficha agora. Tente novamente em instantes.", embeds: [], components: [] });
      }
      return interaction.reply({ content: "Não consegui consultar a ficha agora. Tente novamente em instantes.", flags: 64 });
    }
  },
});
