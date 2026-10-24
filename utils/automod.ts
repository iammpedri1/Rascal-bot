const {
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const emoji = require("./emojis");
const { isRaidModeEnabled } = require("./raidMode");
const logger = require("./logger");
const { randomColor } = require("./embedStyle") as { randomColor: () => number };
const db = require("./db");
const { moderateImageAttachments } = require("./imageModeration");

const LOG_CHANNEL_ID = process.env.AUTOMOD_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID || "";
const IGNORED_ROLE_IDS = String(process.env.AUTOMOD_IGNORED_ROLE_IDS || "")
  .split(",")
  .map(id => id.trim())
  .filter(Boolean);
const IGNORED_CHANNEL_IDS = String(process.env.AUTOMOD_IGNORED_CHANNEL_IDS || "")
  .split(",")
  .map(id => id.trim())
  .filter(Boolean);
const MAX_MENTIONS = Number(process.env.AUTOMOD_MAX_MENTIONS || 6);
const TIMEOUT_MINUTES = Number(process.env.AUTOMOD_TIMEOUT_MINUTES || 5);
const PUNISHMENT_GIF_URL = process.env.AUTOMOD_PUNISHMENT_GIF_URL ||
  "https://media.tenor.com/LRgJSoGK4xAAAAAM/pepe-police.gif";

const INFRACTION_WINDOW_MS = 10 * 60 * 1000;
const INFRACTION_LIMIT = 3;
const REPEAT_WINDOW_MS = 12 * 1000;
const REPEAT_LIMIT = 3;
const TRANSIENT_STATE_TTL_MS = INFRACTION_WINDOW_MS;
const MAX_TRACKED_USERS = 10_000;

const infractions = new Map();
const repeatedMessages = new Map();
let messagesUntilPrune = 0;

function pruneTransientState(now) {
  messagesUntilPrune += 1;
  if (messagesUntilPrune < 256 && infractions.size <= MAX_TRACKED_USERS && repeatedMessages.size <= MAX_TRACKED_USERS) return;
  messagesUntilPrune = 0;

  for (const [key, timestamps] of infractions) {
    if (!timestamps.length || now - timestamps[timestamps.length - 1] > TRANSIENT_STATE_TTL_MS) infractions.delete(key);
  }
  for (const [key, state] of repeatedMessages) {
    if (now - state.lastSeen > REPEAT_WINDOW_MS) repeatedMessages.delete(key);
  }
  while (infractions.size > MAX_TRACKED_USERS) infractions.delete(infractions.keys().next().value);
  while (repeatedMessages.size > MAX_TRACKED_USERS) repeatedMessages.delete(repeatedMessages.keys().next().value);
}

const icons = {
  user: "<:1000106067:1499822530213445825>",
  id: "<:1000106076:1499822871667540121>",
  get staff() { return emoji.staff; },
  get reason() { return emoji.clipboard; },
  get frog() { return emoji.policePanda; },
  get police() { return emoji.policePanda; },
};

const INVITE_REGEX = /\b(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/i;
const URL_REGEX = /\bhttps?:\/\/[^\s<>()]+/i;
const SUSPICIOUS_LINK_REGEX = /\bhttps?:\/\/(?:[^\s/]+\.)?(?:bit\.ly|tinyurl\.com|t\.co|grabify\.link|iplogger\.org|linkvertise\.com|discord-gift|steamcommunity\.ru|dlscord|dicsord|discorcl)[^\s]*/i;

function nowId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

function normalizedContent(message) {
  return String(message.content || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasIgnoredRole(member) {
  if (!member) return false;
  return member.roles.cache.some(role => IGNORED_ROLE_IDS.includes(role.id));
}

function shouldIgnore(message) {
  if (!message.guild || !message.member || message.author.bot || message.webhookId || message.system) return true;
  if (message.author.id === message.guild.ownerId) return true;
  if (IGNORED_CHANNEL_IDS.includes(message.channelId)) return true;
  if (hasIgnoredRole(message.member)) return true;

  const permissions = message.member.permissions;
  return permissions?.has(PermissionFlagsBits.Administrator);
}

function detectRepeatedSpam(message) {
  const content = normalizedContent(message);
  if (!content || content.length < 4) return false;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  pruneTransientState(now);
  const state = repeatedMessages.get(key) || {
    content,
    timestamps: [],
    lastSeen: now,
  };

  if (state.content !== content) {
    state.content = content;
    state.timestamps = [];
  }

  state.timestamps = state.timestamps.filter(timestamp => now - timestamp <= REPEAT_WINDOW_MS);
  state.timestamps.push(now);
  state.lastSeen = now;
  repeatedMessages.set(key, state);

  return state.timestamps.length >= REPEAT_LIMIT;
}

function detectViolation(message) {
  const content = message.content || "";
  const mentionCount = message.mentions.users.size + message.mentions.roles.size;

  if (INVITE_REGEX.test(content)) return "Convite Discord não autorizado.";
  if (mentionCount > MAX_MENTIONS) return `Excesso de menções (${mentionCount}/${MAX_MENTIONS}).`;
  if (SUSPICIOUS_LINK_REGEX.test(content)) return "Link suspeito detectado.";
  if (isRaidModeEnabled(message.guild.id) && URL_REGEX.test(content)) return "Links bloqueados durante o raidmode.";
  if (detectRepeatedSpam(message)) return "Spam de mensagens repetidas.";

  return null;
}

function addInfraction(message) {
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  pruneTransientState(now);
  const list = (infractions.get(key) || []).filter(timestamp => now - timestamp <= INFRACTION_WINDOW_MS);

  list.push(now);
  infractions.set(key, list);

  return list.length;
}

function createPunishmentEmbed(message, reason, moderatorName, punishmentId, gifUrl, timedOut) {
  const user = message.author;
  const channel = message.channel;
  const date = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${user.tag} • Avisado`)
    .setDescription(
      [
        `${icons.frog} • Fazer o que né, violou as Diretrizes & Termos de Conduta do Discord™ e levou uma punição top!`,
        `Da próxima vez, fique mais atento no chat ${channel}.`,
        timedOut ? `${emoji.clock} • Timeout aplicado por **${TIMEOUT_MINUTES} minutos**.` : null,
      ].filter(Boolean).join("\n")
    )
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      {
        name: `${icons.user} • Tag do usuário`,
        value: `\`${user.tag}\``,
        inline: false,
      },
      {
        name: `${icons.id} • ID do Usuário`,
        value: `\`${user.id}\``,
        inline: false,
      },
      {
        name: `${icons.staff} • Punido por`,
        value: moderatorName || "AutoMod",
        inline: false,
      },
      {
        name: `${icons.reason} • Motivo`,
        value: reason,
        inline: false,
      }
    )
    .setImage(gifUrl)
    .setFooter({
      text: `ID: ${punishmentId} | ${date}`,
    })
    .setTimestamp();
}

async function findLogChannel(message) {
  const configured = db.prepare(
    "SELECT log_channel_id FROM moderation_guild_settings WHERE guild_id = ?"
  ).get(String(message.guild.id))?.log_channel_id;
  const channelId = configured || LOG_CHANNEL_ID;
  if (channelId) {
    const channel = await message.guild.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased()) return channel;
  }

  return message.guild.channels.cache.find(channel =>
    channel.isTextBased?.() &&
    ["logs", "mod-log", "modlogs", "punições", "punicoes", "automod"].includes(channel.name.toLowerCase())
  ) || null;
}

function recordAutoCase(message, action, reason, durationMs = null) {
  const result = db.prepare(`
    INSERT INTO moderation_punishments (
      guild_id, guild_name, target_id, target_username, moderator_id,
      moderator_username, action, reason, duration_ms, issued_at, expires_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'applied')
  `).run(
    message.guild.id,
    message.guild.name,
    message.author.id,
    message.author.tag || message.author.username,
    message.client.user?.id || "automod",
    "Rascal • AutoMod",
    action,
    String(reason).slice(0, 900),
    durationMs,
    Date.now(),
    durationMs ? Date.now() + durationMs : null,
  );
  return Number(result.lastInsertRowid);
}

async function notifyUser(message, embed) {
  return message.author.send({ embeds: [embed] }).catch(() => null);
}

async function applyTimeoutIfNeeded(message, count, reason) {
  if (count < INFRACTION_LIMIT) return false;
  if (!message.member?.moderatable) return false;

  await message.member.timeout(
    TIMEOUT_MINUTES * 60 * 1000,
    `AutoMod nível 2: ${reason}`
  );

  return true;
}

async function handleAutoMod(message) {
  try {
    if (shouldIgnore(message)) return false;

    let reason = detectViolation(message);
    let action = "aviso_automod";
    if (!reason && message.attachments.size > 0) {
      const result = await moderateImageAttachments(message);
      if (result.flagged) {
        reason = `Imagem removida pela moderação automática: ${result.reason}.`;
        action = "aviso_ia";
      }
    }
    if (!reason) return false;

    let deleted = false;
    if (message.deletable) {
      deleted = Boolean(await message.delete().then(() => true).catch(() => false));
    }

    const count = addInfraction(message);
    const timedOut = await applyTimeoutIfNeeded(message, count, reason).catch(error => {
      logger.warn("AutoMod não conseguiu aplicar timeout", { error: error.message });
      return false;
    });
    const caseAction = timedOut ? "mute" : action;
    const punishmentId = recordAutoCase(
      message,
      caseAction,
      `${reason}${timedOut ? ` Timeout automático de ${TIMEOUT_MINUTES} minutos.` : ""}`,
      timedOut ? TIMEOUT_MINUTES * 60 * 1000 : null,
    );
    const embed = createPunishmentEmbed(
      message,
      `${reason}\nInfrações recentes: **${count}/${INFRACTION_LIMIT}**${deleted ? "\nMensagem removida." : "\nNão consegui remover a mensagem; confira minha permissão Gerenciar mensagens."}`,
      "AutoMod",
      punishmentId,
      PUNISHMENT_GIF_URL,
      timedOut
    );
    const logChannel = await findLogChannel(message);

    await notifyUser(message, embed);
    if (logChannel) {
      const logged = await logChannel.send({ embeds: [embed] }).catch(() => null);
      if (logged) {
        db.prepare(`UPDATE moderation_punishments SET log_channel_id = ?, log_message_id = ? WHERE id = ?`)
          .run(logChannel.id, logged.id, punishmentId);
      }
    } else {
      await message.channel.send({ embeds: [embed] }).catch(() => null);
    }

    return true;
  } catch (error) {
    logger.error("Erro no AutoMod", error, {
      guild: message.guild?.id,
      channel: message.channelId,
      user: message.author?.id,
    });
    return false;
  }
}

module.exports = {
  LOG_CHANNEL_ID,
  IGNORED_CHANNEL_IDS,
  IGNORED_ROLE_IDS,
  MAX_MENTIONS,
  PUNISHMENT_GIF_URL,
  TIMEOUT_MINUTES,
  createPunishmentEmbed,
  handleAutoMod,
};
