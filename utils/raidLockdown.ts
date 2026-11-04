
const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("./db");
const logger = require("./logger");
const { enableRaidMode, disableRaidMode } = require("./raidMode");
const { randomColor } = require("./embedStyle");

const STAFF_ROLE_IDS = String(process.env.STAFF_ROLE_IDS || "")
  .split(",").map(id => id.trim()).filter(Boolean);
const LOG_CHANNEL_ID = process.env.RAIDMODE_LOG_CHANNEL_ID || process.env.AUTOMOD_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID || "";

function permissionState(overwrite, permission) {
  if (overwrite?.allow.has(permission)) return "allow";
  if (overwrite?.deny.has(permission)) return "deny";
  return "neutral";
}

function stateValue(state) {
  return state === "allow" ? true : state === "deny" ? false : null;
}

function getPublicTextChannels(guild) {
  return [...guild.channels.cache.values()].filter(channel => {
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return false;
    return Boolean(channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel));
  });
}

async function resolveLogChannel(guild) {
  const configured = db.prepare("SELECT log_channel_id FROM moderation_guild_settings WHERE guild_id = ?")
    .get(String(guild.id))?.log_channel_id;
  const channelId = configured || LOG_CHANNEL_ID;
  if (channelId) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased?.()) return channel;
  }
  return guild.channels.cache.find(channel => channel.isTextBased?.() &&
    ["logs", "mod-log", "modlogs", "automod", "staff"].includes(channel.name.toLowerCase())) || null;
}

function snapshotLockdown(guild, channels, activatedBy, reason) {
  const everyoneId = guild.roles.everyone.id;
  const rows = channels.map(channel => {
    const overwrite = channel.permissionOverwrites.cache.get(everyoneId);
    return {
      guildId: String(guild.id),
      channelId: String(channel.id),
      sendMessages: permissionState(overwrite, PermissionFlagsBits.SendMessages),
      createInvite: permissionState(overwrite, PermissionFlagsBits.CreateInstantInvite),
    };
  });
  const save = db.transaction(() => {
    db.prepare(`
      INSERT INTO raid_lockdowns (guild_id, enabled_at, activated_by, reason, verification_level, status)
      VALUES (?, ?, ?, ?, ?, 'active')
      ON CONFLICT(guild_id) DO UPDATE SET
        enabled_at = excluded.enabled_at,
        activated_by = excluded.activated_by,
        reason = excluded.reason,
        verification_level = excluded.verification_level,
        status = 'active'
    `).run(String(guild.id), Date.now(), String(activatedBy), String(reason).slice(0, 500), Number(guild.verificationLevel));

    const insert = db.prepare(`
      INSERT INTO raid_lockdown_channel_state (guild_id, channel_id, send_messages, create_instant_invite)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, channel_id) DO UPDATE SET
        send_messages = excluded.send_messages,
        create_instant_invite = excluded.create_instant_invite
    `);
    for (const row of rows) insert.run(row.guildId, row.channelId, row.sendMessages, row.createInvite);
  });
  save();
}

async function activateRaidLockdown(guild, { activatedBy = "anti-raid", reason = "Pico anormal de entradas" } = {}) {
  const existing = db.prepare("SELECT status FROM raid_lockdowns WHERE guild_id = ?")
    .get(String(guild.id));
  if (existing?.status === "active") return { alreadyActive: true, locked: 0, failed: [] };

  const channels = getPublicTextChannels(guild);
  snapshotLockdown(guild, channels, activatedBy, reason);
  enableRaidMode(guild.id, { by: activatedBy, reason, enabledAt: Date.now() });

  const failures = [];
  for (let start = 0; start < channels.length; start += 5) {
    const batch = channels.slice(start, start + 5);
    await Promise.all(batch.map(async channel => {
      try {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: false,
          CreateInstantInvite: false,
        }, { reason: `Anti-raid: ${String(reason).slice(0, 400)}` });
        return true;
      } catch (error) {
        failures.push({ channelId: channel.id, error: String(error instanceof Error ? error.message : error).slice(0, 180) });
        return false;
      }
    }));
  }

  let verificationChanged = false;
  if (typeof guild.setVerificationLevel === "function") {
    try {
      await guild.setVerificationLevel(4, `Anti-raid: ${String(reason).slice(0, 400)}`);
      verificationChanged = true;
    } catch (error) {
      failures.push({ channelId: "verification", error: String(error instanceof Error ? error.message : error).slice(0, 180) });
    }
  }

  const logChannel = await resolveLogChannel(guild);
  const embed = new EmbedBuilder()
    .setColor(failures.length ? 0xe67e22 : 0xe74c3c)
    .setTitle("🚨 Lockdown anti-raid ativado")
    .setDescription([
      `**Motivo:** ${String(reason).slice(0, 700)}`,
      `**Canais protegidos:** ${channels.length - failures.filter(item => item.channelId !== "verification").length}/${channels.length}`,
      "Convites novos foram bloqueados por permissão; links de convites já criados continuam ativos.",
      verificationChanged ? "Verificação do servidor elevada temporariamente." : "Não foi possível elevar a verificação do servidor.",
      failures.length ? `**Falhas:** ${failures.length}; a contenção ficou parcialmente aplicada e pode ser restaurada por /raidmode desativar.` : null,
    ].filter(Boolean).join("\n"))
    .setTimestamp();
  const content = STAFF_ROLE_IDS.map(id => `<@&${id}>`).join(" ") || undefined;
  await logChannel?.send({
    content,
    embeds: [embed],
    allowedMentions: { roles: STAFF_ROLE_IDS },
  }).catch(error => logger.warn("Falha ao publicar alerta de lockdown", { error: String(error instanceof Error ? error.message : error) }));

  logger.warn("Lockdown anti-raid aplicado", { guildId: guild.id, channelCount: channels.length, failureCount: failures.length });
  return { alreadyActive: false, locked: channels.length - failures.filter(item => item.channelId !== "verification").length, failed: failures };
}

async function disableRaidLockdown(guild, actor = "staff") {
  const lockdown = db.prepare("SELECT * FROM raid_lockdowns WHERE guild_id = ?")
    .get(String(guild.id));
  if (!lockdown || lockdown.status !== "active") {
    disableRaidMode(guild.id);
    return { restored: 0, failed: [], inactive: true };
  }

  const rows = db.prepare(`
    SELECT channel_id, send_messages, create_instant_invite
    FROM raid_lockdown_channel_state WHERE guild_id = ? ORDER BY channel_id
  `).all(String(guild.id));
  const failures = [];
  let restored = 0;
  for (const row of rows) {
    const channel = guild.channels.cache.get(row.channel_id) || await guild.channels.fetch(row.channel_id).catch(() => null);
    if (!channel?.permissionOverwrites) {
      db.prepare("DELETE FROM raid_lockdown_channel_state WHERE guild_id = ? AND channel_id = ?")
        .run(String(guild.id), String(row.channel_id));
      continue;
    }
    try {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: stateValue(row.send_messages),
        CreateInstantInvite: stateValue(row.create_instant_invite),
      }, { reason: `Lockdown anti-raid encerrado por ${actor}` });
      db.prepare("DELETE FROM raid_lockdown_channel_state WHERE guild_id = ? AND channel_id = ?")
        .run(String(guild.id), String(row.channel_id));
      restored += 1;
    } catch (error) {
      failures.push({ channelId: row.channel_id, error: String(error instanceof Error ? error.message : error).slice(0, 180) });
    }
  }

  if (lockdown.verification_level !== null && typeof guild.setVerificationLevel === "function") {
    try {
      await guild.setVerificationLevel(Number(lockdown.verification_level), `Lockdown anti-raid encerrado por ${actor}`);
    } catch (error) {
      failures.push({ channelId: "verification", error: String(error instanceof Error ? error.message : error).slice(0, 180) });
    }
  }

  if (!failures.length) {
    db.prepare("UPDATE raid_lockdowns SET status = 'disabled' WHERE guild_id = ?").run(String(guild.id));
    disableRaidMode(guild.id);
  }
  return { restored, failed: failures, inactive: false };
}

function initializeRaidLockdowns() {
  const active = db.prepare("SELECT guild_id, enabled_at, activated_by, reason FROM raid_lockdowns WHERE status = 'active'").all();
  for (const row of active) {
    enableRaidMode(row.guild_id, { enabledAt: row.enabled_at, by: row.activated_by, reason: row.reason });
  }
  return active.length;
}

module.exports = { activateRaidLockdown, disableRaidLockdown, initializeRaidLockdowns };
