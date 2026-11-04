import {
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";
import { defineCommand } from "../types/command";
import type { CommandChatInputInteraction } from "../types/command";

const db = require("../utils/db");
const emoji = require("../utils/emojis");

function formatTimestamp(ms: number): string {
    return `<t:${Math.floor(ms / 1000)}:f>`;
}

function getActionLabel(action: string): string {
    const labels: Record<string, string> = {
        banir: "BANIMENTO",
        expulsar: "EXPULSÃO",
        mute: "SILENCIAMENTO",
        castigo: "CASTIGO",
        aviso: "ADVERTÊNCIA",
    };
    return labels[action] || action.toUpperCase();
}

function getActionEmoji(action: string): string {
    const emojis: Record<string, string> = {
        banir: "🔨",
        expulsar: "👢",
        mute: "🔇",
        castigo: "🚫",
        aviso: "📝",
    };
    return emoji.application(action, emojis[action] || "⚖️");
}

module.exports = defineCommand({
    category: "staff",

    data: new SlashCommandBuilder()
        .setName("modlog")
        .setDescription("Consulta o registro histórico de sanções de um membro")
        .setDMPermission(false)
        .addUserOption((option) =>
            option.setName("usuario").setDescription("Usuário para consulta de histórico").setRequired(true)
        ),

    async execute(interaction: CommandChatInputInteraction) {
        if (!interaction.guild) return;

        const targetUser = interaction.options.getUser("usuario", true);

        // Buscar punições no banco
        const punishments = db.prepare(`
      SELECT * FROM moderation_punishments 
      WHERE target_id = ? AND guild_id = ? 
      ORDER BY issued_at DESC 
      LIMIT 10
    `).all(targetUser.id, interaction.guildId);

        if (punishments.length === 0) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x2b2d31)
                    .setDescription(`${emoji.application("peep_police", "👮")} Nenhum registro de sanção foi localizado para ${targetUser}.`)
                ],
                flags: 64,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setAuthor({
                name: `Registro Disciplinar • ${targetUser.username}`,
                iconURL: targetUser.displayAvatarURL(),
            })
            .setThumbnail(emoji.getEmojiDetails("peep_police")?.imageUrl || null)
            .setFooter({
                text: "Discord Brasil™ • Central de Moderação",
                iconURL: emoji.getEmojiDetails("peep_police")?.imageUrl || undefined,
            });

        const description = punishments.map((p: any) => {
            const date = formatTimestamp(p.issued_at);
            const actionLabel = getActionLabel(p.action);
            const actionEmoji = getActionEmoji(p.action);

            return `${actionEmoji} **[#${p.id}] ${actionLabel}**\n` +
                `📅 Data: ${date}\n` +
                `👮 Moderador: <@${p.moderator_id}>\n` +
                `📜 Razão: \`${p.reason}\`\n` +
                (p.duration_ms ? `⏳ Vigência: \`${Math.floor(p.duration_ms / 60000)}min\`\n` : "") +
                "──────────────────";
        }).join("\n");

        embed.setDescription(description);

        await interaction.reply({ embeds: [embed] });
    },
});
