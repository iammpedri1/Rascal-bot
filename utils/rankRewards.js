const db = require("./db");
const {
  addBalance,
  pushTransaction,
  updateStats,
} = require("./cookieEconomy");
const logger = require("./logger");
const { syncActiveVoiceSessions } = require("./voiceStats");

const PRIZES = [15000, 10000, 5000];
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function weekStartDate(now = Date.now()) {
  const date = new Date(now);
  const dayFromMonday = (date.getUTCDay() + 6) % 7;

  date.setUTCDate(date.getUTCDate() - dayFromMonday);
  date.setUTCHours(0, 0, 0, 0);

  return date;
}

function weekKeyFromDate(date) {
  return date.toISOString().slice(0, 10);
}

function previousWeekKey(now = Date.now()) {
  const start = weekStartDate(now);
  start.setUTCDate(start.getUTCDate() - 7);
  return weekKeyFromDate(start);
}

function ensureUser(userId, username) {
  const now = Date.now();

  db.prepare(`
    INSERT INTO usuarios (id, username, cookies, created_at, updated_at)
    VALUES (?, ?, 100, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = COALESCE(excluded.username, usuarios.username),
      updated_at = excluded.updated_at
  `).run(String(userId), username || `usuario-${userId}`, now, now);
}

function hasAwarded(guildId, weekKey, rankType) {
  return Boolean(db.prepare(`
    SELECT 1
    FROM rank_reward_claims
    WHERE guild_id = ? AND week_key = ? AND rank_type = ?
  `).get(String(guildId), weekKey, rankType));
}

function markAwarded(guildId, weekKey, rankType) {
  db.prepare(`
    INSERT OR IGNORE INTO rank_reward_claims (guild_id, week_key, rank_type, awarded_at)
    VALUES (?, ?, ?, ?)
  `).run(String(guildId), weekKey, rankType, Date.now());
}

function getMessageTop(guildId, weekKey) {
  return db.prepare(`
    SELECT
      stats.user_id AS id,
      users.username AS username,
      stats.messages AS score
    FROM message_weekly_stats stats
    LEFT JOIN usuarios users ON users.id = stats.user_id
    WHERE stats.guild_id = ? AND stats.week_key = ? AND stats.messages > 0
    ORDER BY stats.messages DESC, users.username COLLATE NOCASE ASC
    LIMIT 3
  `).all(String(guildId), weekKey);
}

function getVoiceTop(guildId, weekKey) {
  return db.prepare(`
    SELECT
      stats.user_id AS id,
      users.username AS username,
      stats.seconds AS score
    FROM voice_weekly_stats stats
    LEFT JOIN usuarios users ON users.id = stats.user_id
    WHERE stats.guild_id = ? AND stats.week_key = ? AND stats.seconds > 0
    ORDER BY stats.seconds DESC, users.username COLLATE NOCASE ASC
    LIMIT 3
  `).all(String(guildId), weekKey);
}

async function awardRank(client, guild, rankType, weekKey, rows) {
  if (!rows.length || hasAwarded(guild.id, weekKey, rankType)) return [];

  const winners = [];

  for (let index = 0; index < rows.length && index < PRIZES.length; index++) {
    const row = rows[index];
    const prize = PRIZES[index];
    const member = await guild.members.fetch(row.id).catch(() => null);
    const username = member?.user?.username || row.username || `usuario-${row.id}`;

    ensureUser(row.id, username);
    addBalance(row.id, prize);
    updateStats(row.id, {
      cookies_won: prize,
      total_earned: prize,
    });
    pushTransaction(`weekly_${rankType}_rank_prize`, row.id, prize, {
      guildId: guild.id,
      guildName: guild.name,
      note: `Top ${index + 1} da semana ${weekKey}`,
    });

    winners.push({
      id: String(row.id),
      username,
      position: index + 1,
      prize,
      score: integer(row.score),
    });
  }

  markAwarded(guild.id, weekKey, rankType);
  logger.success(`Premios semanais de ${rankType} pagos`, {
    guild: guild.name,
    weekKey,
    winners: winners.length,
  });

  return winners;
}

async function awardPreviousWeekRanks(client) {
  const weekKey = previousWeekKey();

  for (const guild of client.guilds.cache.values()) {
    try {
      syncActiveVoiceSessions(guild);

      await awardRank(client, guild, "messages", weekKey, getMessageTop(guild.id, weekKey));
      await awardRank(client, guild, "voice", weekKey, getVoiceTop(guild.id, weekKey));
    } catch (err) {
      logger.error(`Erro ao pagar premios semanais em ${guild.name}`, err);
    }
  }
}

function startRankRewardScheduler(client) {
  setTimeout(() => awardPreviousWeekRanks(client).catch(err => {
    logger.error("Erro no primeiro ciclo de premios semanais", err);
  }), 15000);

  setInterval(() => awardPreviousWeekRanks(client).catch(err => {
    logger.error("Erro no ciclo de premios semanais", err);
  }), CHECK_INTERVAL_MS);
}

module.exports = {
  PRIZES,
  awardPreviousWeekRanks,
  startRankRewardScheduler,
};
