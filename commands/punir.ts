import { defineCommand } from "../types/command";
const {
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");

const db = require("../utils/db");
const emoji = require("../utils/emojis");
const logger = require("../utils/logger");
const { buildInlineErrorEmbed } = require("../utils/cookieViews");

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

// Duração usada quando a Staff não informa "duracao" em mute/castigo.
const DEFAULT_TIMEOUTS = {
    mute: 60 * 60 * 1000,
    castigo: 24 * 60 * 60 * 1000,
};

const punicoes = {
    banir: {
        label: "Banimento Aplicado",
        actionLabel: "BANIMENTO",
        description: "das terras de nossa comunidade!",
        color: 0x2b2d31,
        gif: "https://cdn3.emoji.gg/emojis/5076-pepe-ban.gif",
        permission: PermissionFlagsBits.BanMembers,
        reasonPrefix: "Banimento",
    },
    expulsar: {
        label: "Expulsão Aplicada",
        actionLabel: "EXPULSÃO",
        description: "de nossa comunidade!",
        color: 0x2b2d31,
        gif: "https://cdn3.emoji.gg/emojis/4381-pengu-popo-police.gif",
        permission: PermissionFlagsBits.KickMembers,
        reasonPrefix: "Expulsão",
    },
    mute: {
        label: "Silenciamento Aplicado",
        actionLabel: "SILENCIAMENTO",
        description: "por tempo determinado.",
        color: 0x2b2d31,
        gif: "https://cdn3.emoji.gg/emojis/6454-peepotalk.gif",
        permission: PermissionFlagsBits.ModerateMembers,
        reasonPrefix: "Mute",
    },
    castigo: {
        label: "Castigo Aplicado",
        actionLabel: "CASTIGO",
        description: "por tempo determinado.",
        color: 0x2b2d31,
        gif: "https://cdn3.emoji.gg/emojis/5599-peepo-jail.gif",
        permission: PermissionFlagsBits.ModerateMembers,
        reasonPrefix: "Castigo",
    },
    aviso: {
        label: "Advertência Aplicada",
        actionLabel: "ADVERTÊNCIA",
        description: "por comportamento inadequado.",
        color: 0x2b2d31,
        gif: "https://cdn3.emoji.gg/emojis/433681-lastwarning.gif",
        permission: null,
        reasonPrefix: "Aviso",
    },
};

function hasPermission(interaction, permission) {
    return Boolean(
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
        (permission && interaction.memberPermissions?.has(permission))
    );
}

function isStaff(interaction) {
    return hasPermission(interaction, PermissionFlagsBits.ModerateMembers) ||
        hasPermission(interaction, PermissionFlagsBits.BanMembers) ||
        interaction.member?.roles?.cache?.some(role =>
            ["admin", "administrador", "mod", "moderador", "staff"].includes(role.name.toLowerCase())
        );
}

function parseDuration(value, fallback) {
    if (!value) return fallback ?? null;
    const match = value.trim().toLowerCase().match(/^(\d+)\s*(m|min|h|hora|horas|d|dia|dias)$/);
    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2];
    const multiplier = unit.startsWith("m")
        ? 60 * 1000
        : unit.startsWith("h")
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;
    const duration = amount * multiplier;
    return amount > 0 && duration <= MAX_TIMEOUT_MS ? duration : null;
}

function getGuildSettings(guildId) {
    return db.prepare("SELECT * FROM moderation_guild_settings WHERE guild_id = ?").get(String(guildId));
}

function buildPunishmentEmbed(interaction, targetUser, action, reason) {
    const now = new Date();
    const dateStr = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(now);

    const embed = new EmbedBuilder()
        .setColor(action.color)
        .setTitle(`${action.actionLabel === "BANIMENTO" ? "🔨" : action.actionLabel === "EXPULSÃO" ? "👢" : action.actionLabel === "SILENCIAMENTO" ? "🤐" : "⚠️"} • ${targetUser.tag || targetUser.username} • ${action.actionLabel}`)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .setDescription(
            `�️ • ${targetUser} recebeu um **${action.actionLabel}** ${action.description}\n\n` +
            `O usuário violou as **Diretrizes e Termos de Conduta** da comunidade, resultando na aplicação desta sanção. Recomendamos a leitura atenta das regras no canal <#${interaction.channelId}>.`
        )
        .addFields(
            {
                name: `👤 Tag do Usuário`,
                value: `\`${targetUser.username}\``,
                inline: true,
            },
            {
                name: `🆔 ID do Usuário`,
                value: `\`${targetUser.id}\``,
                inline: true,
            },
            {
                name: `👮 Moderador`,
                value: `\`${interaction.user.id}\``,
                inline: true,
            },
            {
                name: `📜 Razão`,
                value: reason,
                inline: false,
            },
            {
                name: `🕙 Data da Sanção`,
                value: `\`${dateStr}\``,
                inline: false,
            }
        )
        .setFooter({
            text: `Discord Brasil™ • Central de Moderação`,
            iconURL: emoji.getEmojiDetails("peep_police")?.imageUrl || undefined,
        });

    return embed;
}

async function applyAction(interaction, targetUser, actionKey, reason, durationMs) {
    const action = punicoes[actionKey];
    if (action.permission && !hasPermission(interaction, action.permission)) {
        return `Você não possui as permissões necessárias para aplicar esta sanção.`;
    }

    if (targetUser.id === interaction.guild.ownerId) return "O proprietário do servidor não pode ser sancionado.";

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (member && interaction.user.id !== interaction.guild.ownerId &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (moderator && member.roles.highest.position >= moderator.roles.highest.position) {
            return "Não é possível punir um membro com cargo equivalente ou superior ao seu.";
        }
    }

    const auditReason = `${action.reasonPrefix} aplicado por ${interaction.user.tag}: ${reason}`.slice(0, 512);

    try {
        if (actionKey === "banir") {
            if (member && !member.bannable) return "Falha ao banir: verifique a hierarquia de cargos e minhas permissões.";
            await interaction.guild.members.ban(targetUser.id, { reason: auditReason });
        } else if (actionKey === "expulsar") {
            if (!member) return "O usuário deve estar no servidor para ser expulso.";
            if (!member.kickable) return "Falha ao expulsar: verifique a hierarquia de cargos e minhas permissões.";
            await member.kick(auditReason);
        } else if (actionKey === "mute" || actionKey === "castigo") {
            if (!member) return "O usuário deve estar no servidor para receber um silenciamento temporário.";
            if (!member.moderatable) return "Falha ao aplicar silenciamento: verifique a hierarquia de cargos e minhas permissões.";
            if (!durationMs) return "Duração inválida para esta sanção.";
            await member.timeout(durationMs, auditReason);
        }
    } catch (err) {
        logger.error(`Erro ao aplicar ${actionKey}`, err);
        return "Ocorreu um erro na comunicação com o Discord. Verifique as permissões e a hierarquia de cargos.";
    }

    return null;
}

module.exports = defineCommand({
    category: "staff",

    data: new SlashCommandBuilder()
        .setName("punir")
        .setDescription("Aplica uma sanção disciplinar a um membro da comunidade")
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName("usuario").setDescription("Usuário que receberá a sanção").setRequired(true)
        )
        .addStringOption(option =>
            option.setName("acao").setDescription("Tipo de sanção").setRequired(true).addChoices(
                { name: "🔨 Banir", value: "banir" },
                { name: "👢 Expulsar", value: "expulsar" },
                { name: "🔇 Silenciar", value: "mute" },
                { name: "🚫 Castigo", value: "castigo" },
                { name: "📝 Advertência", value: "aviso" },
            )
        )
        .addStringOption(option =>
            option.setName("motivo").setDescription("Razão da sanção").setRequired(true).setMaxLength(900)
        )
        .addStringOption(option =>
            option.setName("duracao").setDescription("Duração (ex: 30m, 2h, 7d) - Padrão: 1h silenciamento / 1d castigo").setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.guild) return;

        if (!isStaff(interaction)) {
            return interaction.reply({
                embeds: [buildInlineErrorEmbed("Este comando é restrito à equipe de moderação.")],
                flags: 64,
            });
        }

        const targetUser = interaction.options.getUser("usuario");
        const actionKey = interaction.options.getString("acao");
        const reason = (interaction.options.getString("motivo") || "").trim();
        const inputDuration = interaction.options.getString("duracao");
        const action = punicoes[actionKey];

        if (!action) {
            return interaction.reply({ embeds: [buildInlineErrorEmbed("Tipo de sanção inválido.")], flags: 64 });
        }

        if (!reason) {
            return interaction.reply({ embeds: [buildInlineErrorEmbed("Por favor, especifique a razão da sanção.")], flags: 64 });
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ embeds: [buildInlineErrorEmbed("Não é possível aplicar sanções ao próprio perfil.")], flags: 64 });
        }

        const usesDuration = actionKey === "mute" || actionKey === "castigo";

        if (inputDuration && !usesDuration) {
            return interaction.reply({
                embeds: [buildInlineErrorEmbed("A especificação de duração é válida apenas para silenciamento e castigo.")],
                flags: 64,
            });
        }

        let durationMs = null;
        if (usesDuration) {
            durationMs = parseDuration(inputDuration, DEFAULT_TIMEOUTS[actionKey] || null);
            if (!durationMs) {
                return interaction.reply({
                    embeds: [buildInlineErrorEmbed("Formato de duração inválido. Utilize padrões como `30m`, `2h` ou `7d` (máximo 28 dias).")],
                    flags: 64,
                });
            }
        }

        await interaction.deferReply({ flags: 64 });

        // Canal de registro: o configurado em /moderacao ou, na falta dele, o canal do comando.
        const settings = getGuildSettings(interaction.guildId);
        const configuredChannel = settings?.log_channel_id
            ? await interaction.guild.channels.fetch(settings.log_channel_id).catch(() => null)
            : null;
        const logChannel = settings?.log_channel_id ? configuredChannel : interaction.channel;
        const channelPermissions = logChannel?.permissionsFor?.(interaction.client.user);
        const canLog = Boolean(
            logChannel?.isTextBased?.() &&
            channelPermissions?.has([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
            ])
        );

        // Registro pendente: o caso passa a existir antes de a punição ser aplicada.
        const now = Date.now();
        const expiresAt = durationMs ? now + durationMs : null;
        const pending = db.prepare(`
      INSERT INTO moderation_punishments (
        guild_id, guild_name, target_id, target_username, moderator_id, moderator_username,
        action, reason, duration_ms, issued_at, expires_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
            interaction.guildId,
            interaction.guild.name,
            targetUser.id,
            targetUser.username,
            interaction.user.id,
            interaction.user.username,
            actionKey,
            reason,
            durationMs,
            now,
            expiresAt
        );
        const caseId = Number(pending.lastInsertRowid);

        let applyError;
        try {
            applyError = await applyAction(interaction, targetUser, actionKey, reason, durationMs);
        } catch (error) {
            db.prepare("UPDATE moderation_punishments SET status = 'failed', error = ? WHERE id = ?")
                .run(String((error as any)?.message || error).slice(0, 500), caseId);
            logger.error(`Erro ao aplicar ${actionKey}`, error, { caseId, guildId: interaction.guildId });
            return interaction.editReply({
                embeds: [buildInlineErrorEmbed("Ocorreu uma falha na aplicação da sanção. O registro foi mantido para fins de auditoria.")],
            });
        }

        if (applyError) {
            db.prepare("UPDATE moderation_punishments SET status = 'failed', error = ? WHERE id = ?")
                .run(applyError, caseId);
            return interaction.editReply({ embeds: [buildInlineErrorEmbed(applyError)] });
        }

        db.prepare("UPDATE moderation_punishments SET status = 'applied' WHERE id = ?").run(caseId);

        const embed = buildPunishmentEmbed(interaction, targetUser, action, reason);

        let sentMessage = null;
        let logError = null;
        if (canLog) {
            try {
                sentMessage = await logChannel.send({ embeds: [embed] });
                db.prepare(`
          UPDATE moderation_punishments
          SET log_channel_id = ?, log_message_id = ?
          WHERE id = ?
        `).run(logChannel.id, sentMessage.id, caseId);
            } catch (error) {
                logError = String((error as any)?.message || error).slice(0, 500);
                logger.error("Punição aplicada, mas o embed não foi enviado", error, { caseId, guildId: interaction.guildId });
            }
        } else {
            logError = settings?.log_channel_id
                ? "Canal de registros indisponível ou permissões insuficientes."
                : "Canal atual indisponível ou permissões insuficientes.";
        }

        if (logError) {
            db.prepare("UPDATE moderation_punishments SET status = 'applied_log_failed', error = ? WHERE id = ?")
                .run(logError, caseId);
        }

        // Responder ao moderador com o Embed da punição.
        const confirmation = sentMessage
            ? `${emoji.correct} Sanção aplicada com sucesso. O caso **#${caseId}** foi registrado em ${logChannel}.`
            : `${emoji.correct} Sanção aplicada. O caso **#${caseId}** foi registrado, porém a publicação do embed falhou.`;

        await interaction.editReply({ content: confirmation, embeds: [embed] });
    },
});
