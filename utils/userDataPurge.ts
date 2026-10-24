const db = require("./db");
const logger = require("./logger");
const { removeUserReminders } = require("./reminders");
const { getPrimaryGuild, PRIMARY_GUILD_ID } = require("./primaryGuild");

const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH_SIZE = 10;
let schedulerStarted = false;
let purgeRunning = false;

async function isMemberInPrimaryGuild(client, userId) {
  const guild = getPrimaryGuild(client);
  if (!guild) return { member: null, error: new Error("O servidor principal não está disponível.") };
  try {
    await guild.members.fetch({ user: String(userId), force: true });
    return { member: true, guild };
  } catch (error) {
    if ([10007, 10013].includes((error as any)?.code)) return { member: false };
    return { member: null, error };
  }
}

function deleteUserData(userId) {
  const id = String(userId);
  const giveawayIds = db.prepare("SELECT id FROM giveaways WHERE created_by = ?").all(id).map(row => row.id);
  removeUserReminders(id);
  const remove = db.transaction(() => {
    db.prepare("DELETE FROM giveaway_participants WHERE user_id = ?").run(id);
    if (giveawayIds.length) {
      const placeholders = giveawayIds.map(() => "?").join(",");
      db.prepare(`DELETE FROM giveaway_participants WHERE giveaway_id IN (${placeholders})`).run(...giveawayIds);
      db.prepare(`DELETE FROM giveaways WHERE id IN (${placeholders})`).run(...giveawayIds);
    }
    db.prepare("DELETE FROM transacoes WHERE user_id = ? OR target_id = ?").run(id, id);
    db.prepare("DELETE FROM cooldowns WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM cooldown_notifications WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM cookie_shop_inventory WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM afk_status WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM birthdays WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM message_weekly_stats WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM voice_weekly_stats WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM transmission_weekly_stats WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM message_monthly_stats WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM voice_monthly_stats WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM monthly_tax_accounts WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM voice_reward_state WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM guild_memberships WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM moderation_punishments WHERE target_id = ? OR moderator_id = ?").run(id, id);
    db.prepare("UPDATE moderation_guild_settings SET updated_by = '0' WHERE updated_by = ?").run(id);
    const giveaways = db.prepare("SELECT id, winner_ids AS winnerIds FROM giveaways").all();
    for (const giveaway of giveaways) {
      const winnerIds = JSON.parse(giveaway.winnerIds || "[]").filter(winnerId => String(winnerId) !== id);
      if (winnerIds.length !== JSON.parse(giveaway.winnerIds || "[]").length) {
        db.prepare("UPDATE giveaways SET winner_ids = ? WHERE id = ?").run(JSON.stringify(winnerIds), giveaway.id);
      }
    }
    db.prepare("DELETE FROM usuarios WHERE id = ?").run(id);
  });
  remove();
  require("./voiceStats").forgetVoiceUser(id);
}

async function purgeExpiredUsers(client) {
  if (purgeRunning) return;
  purgeRunning = true;
  try {
    const cutoff = Date.now() - RETENTION_MS;
    const candidates = db.prepare(`
      SELECT user_id AS userId, MAX(left_at) AS lastLeftAt
      FROM guild_memberships
      WHERE guild_id = ?
      GROUP BY user_id
      HAVING SUM(CASE WHEN left_at IS NULL THEN 1 ELSE 0 END) = 0
        AND MAX(left_at) <= ?
      ORDER BY MAX(left_at) ASC
      LIMIT ?
    `).all(PRIMARY_GUILD_ID, cutoff, PURGE_BATCH_SIZE);

    const expired = [];
    for (const candidate of candidates) {
      const membership = await isMemberInPrimaryGuild(client, candidate.userId);
      if (membership.member === null) {
        logger.warn("Limpeza de dados pausada: associação ao servidor não pôde ser confirmada", {
          userId: candidate.userId,
          code: (membership.error as any)?.code,
        });
        continue;
      }
      if (membership.member) {
        db.prepare(`
          INSERT INTO guild_memberships (guild_id, user_id, joined_at, left_at)
          VALUES (?, ?, ?, NULL)
          ON CONFLICT(guild_id, user_id) DO UPDATE SET joined_at = COALESCE(joined_at, excluded.joined_at), left_at = NULL
        `).run(String(membership.guild.id), String(candidate.userId), Date.now());
        continue;
      }
      expired.push(candidate.userId);
    }

    if (!expired.length) return;
    for (const userId of expired) deleteUserData(userId);
    logger.warn("Dados antigos removidos após confirmação de saída de 365 dias", {
      users: expired.length,
    });
  } finally {
    purgeRunning = false;
  }
}

function startUserDataPurgeScheduler(client) {
  if (schedulerStarted) return;
  schedulerStarted = true;
  void purgeExpiredUsers(client).catch(error => logger.error("Falha na limpeza de dados antigos", error));
  const timer = setInterval(() => {
    void purgeExpiredUsers(client).catch(error => logger.error("Falha na limpeza de dados antigos", error));
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
}

module.exports = { purgeExpiredUsers, startUserDataPurgeScheduler };
