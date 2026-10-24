import { defineCommand } from "../types/command";
const {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");

const db = require("../utils/db");
const emoji = require("../utils/emojis");
const logger = require("../utils/logger");
const { randomColor } = require("../utils/embedStyle") as { randomColor: () => number };
const { buildInlineErrorEmbed } = require("../utils/cookieViews");

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUTS = {
  mute: 60 * 60 * 1000,
  castigo: 24 * 60 * 60 * 1000,
};

const actions = {
  banir: {
    label: "Banido",
    title: "Banimento aplicado",
    color: 0xed4245,
    get emoji() { return emoji.blobBan; },
    images: [
      "https://cdn3.emoji.gg/emojis/5076-pepe-ban.gif",
      "https://cdn3.emoji.gg/emojis/420126-serverban.gif",
      "https://cdn3.emoji.gg/emojis/514607-ban.gif",
      "https://cdn3.emoji.gg/emojis/276118-banned.gif",
      "https://cdn3.emoji.gg/emojis/43995-banned.gif",
      "https://cdn3.emoji.gg/emojis/656907-ubann.gif",
    ],
    permission: PermissionFlagsBits.BanMembers,
    reasonPrefix: "Banimento",
  },
  expulsar: {
    label: "Expulso",
    title: "Expulsão aplicada",
    color: 0xe67e22,
    get emoji() { return emoji.policePanda; },
    images: [],
    permission: PermissionFlagsBits.KickMembers,
    reasonPrefix: "Expulsão",
  },
  mute: {
    label: "Mutado",
    title: "Timeout aplicado",
    color: 0xf0b232,
    get emoji() { return emoji.sino; },
    images: [
      "https://cdn3.emoji.gg/emojis/6454-peepotalk.gif",
      "https://cdn3.emoji.gg/emojis/92914-mute.gif",
      "https://cdn3.emoji.gg/emojis/940159-mute.gif",
      "https://cdn3.emoji.gg/emojis/81930-mutebutton.gif",
      "https://cdn3.emoji.gg/emojis/433681-lastwarning.gif",
      "https://cdn3.emoji.gg/emojis/478549-nolife.gif",
    ],
    permission: PermissionFlagsBits.ModerateMembers,
    reasonPrefix: "Mute",
  },
  castigo: {
    label: "Castigado",
    title: "Castigo aplicado",
    color: 0x9b59b6,
    get emoji() { return emoji.crossed; },
    images: [
      "https://cdn3.emoji.gg/emojis/5599-peepo-jail.gif",
      "https://cdn3.emoji.gg/emojis/172938-ndc-jail.gif",
      "https://cdn3.emoji.gg/emojis/7297-bonk.gif",
      "https://cdn3.emoji.gg/emojis/32012-pengujail.gif",
      "https://cdn3.emoji.gg/emojis/78690-pengu-sus-police.gif",
      "https://cdn3.emoji.gg/emojis/4381-pengu-popo-police.gif",
    ],
    permission: PermissionFlagsBits.ModerateMembers,
    reasonPrefix: "Castigo",
  },
  aviso: {
    label: "Avisado",
    title: "Aviso registrado",
    color: 0x5865f2,
    get emoji() { return emoji.staff; },
    images: [
      "https://cdn3.emoji.gg/emojis/433681-lastwarning.gif",
      "https://cdn3.emoji.gg/emojis/707922-sentinel-warn.gif",
      "https://cdn3.emoji.gg/emojis/594162-red-siren.gif",
      "https://cdn3.emoji.gg/emojis/953196-pengupolicecar.gif",
      "https://cdn3.emoji.gg/emojis/990262-zomo.gif",
      "https://cdn3.emoji.gg/emojis/106102-busted.gif",
    ],
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
      ["admin", "administrador", "mod", "moderador"].includes(role.name.toLowerCase())
    );
}

function parseDuration(value, fallback) {
  if (!value) return fallback;
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

function formatDuration(ms) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
  if (minutes || !parts.length) parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minutos"}`);
  return parts.slice(0, 2).join(" e ");
}

function getGuildSettings(guildId) {
  return db.prepare("SELECT * FROM moderation_guild_settings WHERE guild_id = ?").get(String(guildId));
}

function buildPunishmentEmbed(interaction, targetUser, action, reason, durationMs, caseId, image) {
  const duration = action === actions.banir
    ? "Permanente"
    : durationMs
      ? formatDuration(durationMs)
      : "Não se aplica";
  const issuedAt = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setColor(randomColor())
    .setAuthor({
      name: `${targetUser.globalName || targetUser.username} • ${action.label}`,
      iconURL: targetUser.displayAvatarURL({ size: 128 }),
    })
    .setDescription(`${action.emoji} **${action.title}**\n${emoji.punishment} ${reason.slice(0, 900)}`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .addFields(
      {
        name: `${emoji.humanIcon} Usuário`,
        value: `${targetUser}\n\`${targetUser.tag || targetUser.username}\``,
        inline: true,
      },
      {
        name: `${emoji.identity} ID`,
        value: `\`${targetUser.id}\``,
        inline: true,
      },
      {
        name: `${emoji.staff} Aplicado por`,
        value: `${interaction.user}\n\`${interaction.user.tag || interaction.user.username}\``,
        inline: true,
      },
      {
        name: `${emoji.clock} Duração`,
        value: duration,
        inline: true,
      },
      {
        name: `${emoji.clipboard} Caso`,
        value: `#${caseId} · <t:${issuedAt}:F>`,
        inline: true,
      },
    )
    .setFooter({
      text: interaction.guild.name,
      iconURL: interaction.guild.iconURL({ size: 64 }) || undefined,
    })
    .setTimestamp();

  if (image) embed.setImage(image);
  return embed;
}

async function applyAction(interaction, targetUser, actionKey, reason, durationMs) {
  const action = actions[actionKey];
  if (action.permission && !hasPermission(interaction, action.permission)) {
    return `Você não tem a permissão necessária para ${action.title.toLowerCase()}.`;
  }

  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (targetUser.id === interaction.guild.ownerId) return "O dono do servidor não pode receber esta punição.";

  if (member && interaction.user.id !== interaction.guild.ownerId &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (moderator && member.roles.highest.position >= moderator.roles.highest.position) {
      return "Você não pode punir alguém com cargo igual ou superior ao seu.";
    }
  }

  const auditReason = `${action.reasonPrefix} por ${interaction.user.tag}: ${reason}`.slice(0, 512);
  if (actionKey === "banir") {
    if (member && !member.bannable) return "Não consegui banir: confira a hierarquia de cargos e minhas permissões.";
    await interaction.guild.members.ban(targetUser.id, { reason: auditReason });
  } else if (actionKey === "expulsar") {
    if (!member) return "Esse usuário precisa estar no servidor para receber expulsão.";
    if (!member.kickable) return "Não consegui expulsar: confira a hierarquia de cargos e minhas permissões.";
    await member.kick(auditReason);
  } else if (actionKey === "mute" || actionKey === "castigo") {
    if (!member) return "Esse usuário precisa estar no servidor para receber timeout.";
    if (!member.moderatable) return "Não consegui aplicar timeout: confira a hierarquia de cargos e minhas permissões.";
    await member.timeout(durationMs, auditReason);
  }
  return null;
}

async function configureGuild(interaction) {
  const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  if (!canManage) {
    return interaction.reply({
      content: "A configuração da moderação exige a permissão **Gerenciar servidor**.",
      flags: 64,
    });
  }

  const channel = interaction.options.getChannel("canal_logs");
  const removeChannel = interaction.options.getBoolean("remover_canal") || false;

  if (channel && removeChannel) {
    return interaction.reply({ content: "Escolha um canal ou `remover_canal`, não os dois.", flags: 64 });
  }
  if (!channel && !removeChannel) {
    return interaction.reply({
      content: "Informe o canal de registros ou use `remover_canal` para voltar ao canal do comando.",
      flags: 64,
    });
  }

  const current = getGuildSettings(interaction.guildId) || {};
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
  if (removeChannel) details.push("Canal removido; os próximos registros aparecerão no canal do comando.");
  details.push("As imagens das punições são escolhidas automaticamente pelo Rascal.");

  return interaction.reply({
    content: `${emoji.correct} Configuração salva neste servidor.\n${details.join("\n")}`,
    flags: 64,
  });
}

async function applyPunishment(interaction) {
  if (!isStaff(interaction)) {
    return interaction.reply({
      embeds: [buildInlineErrorEmbed("Apenas moderadores e administradores podem usar este comando.")],
      flags: 64,
    });
  }

  const targetUser = interaction.options.getUser("usuario");
  const actionKey = interaction.options.getString("acao");
  const reason = interaction.options.getString("motivo").trim();
  const inputDuration = interaction.options.getString("duracao");
  const action = actions[actionKey];
  if (!action) {
    return interaction.reply({ embeds: [buildInlineErrorEmbed("Ação de moderação inválida.")], flags: 64 });
  }
  if (!reason) {
    return interaction.reply({ embeds: [buildInlineErrorEmbed("Informe um motivo para registrar a punição.")], flags: 64 });
  }
  if (targetUser.id === interaction.user.id) {
    return interaction.reply({ embeds: [buildInlineErrorEmbed("Você não pode punir a si mesmo.")], flags: 64 });
  }
  if (inputDuration && !["mute", "castigo"].includes(actionKey)) {
    return interaction.reply({ content: "A duração só se aplica a mute e castigo.", flags: 64 });
  }

  const durationMs = parseDuration(inputDuration, DEFAULT_TIMEOUTS[actionKey] || null);
  if (["mute", "castigo"].includes(actionKey) && !durationMs) {
    return interaction.reply({
      embeds: [buildInlineErrorEmbed("Duração inválida. Use `30m`, `2h` ou `7d` (limite de 28 dias).")],
      flags: 64,
    });
  }

  await interaction.deferReply({ flags: 64 });
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
    targetUser.tag || targetUser.username,
    interaction.user.id,
    interaction.user.tag || interaction.user.username,
    actionKey,
    reason,
    durationMs,
    now,
    expiresAt,
  );
  const caseId = Number(pending.lastInsertRowid);

  let applyError;
  try {
    applyError = await applyAction(interaction, targetUser, actionKey, reason, durationMs);
  } catch (error) {
    db.prepare("UPDATE moderation_punishments SET status = 'failed', error = ? WHERE id = ?")
      .run(String((error as any)?.message || error).slice(0, 500), caseId);
    logger.error("Falha ao aplicar punição", error, { caseId, guildId: interaction.guildId });
    return interaction.editReply({
      embeds: [buildInlineErrorEmbed("O Discord recusou esta punição. O caso ficou registrado como falha.")],
    });
  }

  if (applyError) {
    db.prepare("UPDATE moderation_punishments SET status = 'failed', error = ? WHERE id = ?")
      .run(applyError, caseId);
    return interaction.editReply({ embeds: [buildInlineErrorEmbed(applyError)] });
  }

  db.prepare("UPDATE moderation_punishments SET status = 'applied' WHERE id = ?").run(caseId);
  const image = action.images[Math.floor(Math.random() * action.images.length)];
  const embed = buildPunishmentEmbed(interaction, targetUser, action, reason, durationMs, caseId, image);
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
      ? "Canal configurado indisponível ou sem permissões de envio/embeds."
      : "Canal atual indisponível ou sem permissões de envio/embeds.";
  }

  if (logError) {
    db.prepare("UPDATE moderation_punishments SET status = 'applied_log_failed', error = ? WHERE id = ?")
      .run(logError, caseId);
  }

  const confirmation = sentMessage
    ? `${emoji.correct} ${action.title}. Caso **#${caseId}** registrado em ${logChannel}.`
    : `${emoji.correct} ${action.title}. Caso **#${caseId}** salvo no banco, mas não consegui publicar o embed. Configure um canal com permissões de envio e embeds.`;
  return interaction.editReply({ content: confirmation });
}

module.exports = defineCommand({
  category: "staff",

  data: new SlashCommandBuilder()
    .setName("moderacao")
    .setDescription("Aplica punições e configura os registros do servidor")
    .setDMPermission(false)
    .addSubcommand(subcommand =>
      subcommand
        .setName("aplicar")
        .setDescription("Aplica e registra uma punição")
        .addUserOption(option =>
          option.setName("usuario").setDescription("Usuário que receberá a punição").setRequired(true)
        )
        .addStringOption(option =>
          option.setName("acao").setDescription("Tipo de punição").setRequired(true).addChoices(
            { name: "🔨 Banir", value: "banir" },
            { name: "👢 Expulsar", value: "expulsar" },
            { name: "🔇 Mutar", value: "mute" },
            { name: "🚫 Castigo", value: "castigo" },
            { name: "📝 Avisar", value: "aviso" },
          )
        )
        .addStringOption(option =>
          option.setName("motivo").setDescription("Motivo que ficará no histórico").setRequired(true).setMaxLength(900)
        )
        .addStringOption(option =>
          option.setName("duracao").setDescription("Mute/castigo: 30m, 2h ou 7d; máximo 28d").setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("configurar")
        .setDescription("Configura o canal de registros de punições")
        .addChannelOption(option =>
          option
            .setName("canal_logs")
            .setDescription("Canal onde os embeds de punição serão publicados")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option.setName("remover_canal").setDescription("Volta a publicar no canal em que o comando for usado")
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use `/moderacao` dentro de um servidor.", flags: 64 });
    }

    if (interaction.options.getSubcommand() === "configurar") {
      return configureGuild(interaction);
    }
    return applyPunishment(interaction);
  },
});
