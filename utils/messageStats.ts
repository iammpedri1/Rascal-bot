const db = require("./db");

// recordMessage roda a cada mensagem: as sentenças ficam preparadas uma única
// vez para evitar recompilar SQL (CPU e alocação) no caminho mais quente.
const recordWeeklyStmt = db.prepare(`
  INSERT INTO message_weekly_stats (guild_id, user_id, week_key, messages, updated_at)
  VALUES (?, ?, ?, 1, ?)
  ON CONFLICT(guild_id, user_id, week_key)
  DO UPDATE SET messages = messages + 1, updated_at = excluded.updated_at
`);
const recordMonthlyStmt = db.prepare(`
  INSERT INTO message_monthly_stats (guild_id, user_id, month_key, messages, updated_at)
  VALUES (?, ?, ?, 1, ?)
  ON CONFLICT(guild_id, user_id, month_key)
  DO UPDATE SET messages = messages + 1, updated_at = excluded.updated_at
`);
// Contador vitalício do perfil. O INSERT garante a linha em usuarios para quem
// só conversa e nunca usou um comando de economia (o UPDATE sozinho não criaria).
const recordLifetimeStmt = db.prepare(`
  INSERT INTO usuarios (id, messages_count, created_at, updated_at)
  VALUES (?, 1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    messages_count = messages_count + 1,
    updated_at = excluded.updated_at
`);

function weekKey(now = Date.now()) {
  const date = new Date(now);
  const dayFromMonday = (date.getUTCDay() + 6) % 7;

  date.setUTCDate(date.getUTCDate() - dayFromMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function monthKey(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

function recordMessage(guildId, userId, now = Date.now()) {
  const id = String(userId);
  recordWeeklyStmt.run(String(guildId), id, weekKey(now), now);
  recordMonthlyStmt.run(String(guildId), id, monthKey(now), now);
  recordLifetimeStmt.run(id, now, now);
}

function getWeeklyMessageLeaderboard(guildId, limit = 10) {
  return db.prepare(`
    SELECT stats.user_id AS id, users.username AS username, stats.messages AS messages
    FROM message_weekly_stats stats
    LEFT JOIN usuarios users ON users.id = stats.user_id
    WHERE stats.guild_id = ? AND stats.week_key = ?
    ORDER BY stats.messages DESC, users.username COLLATE NOCASE ASC
    LIMIT ?
  `).all(String(guildId), weekKey(), Math.max(1, Math.floor(Number(limit) || 10)))
    .map((row, index) => ({
      id: row.id,
      username: row.username || `usuario-${row.id}`,
      messages: Number(row.messages) || 0,
      position: index + 1,
    }));
}

function getMonthlyMessageLeaderboard(guildId, requestedMonthKey, limit = 5) {
  return db.prepare(`
    SELECT stats.user_id AS id, users.username AS username, stats.messages AS messages
    FROM message_monthly_stats stats
    LEFT JOIN usuarios users ON users.id = stats.user_id
    WHERE stats.guild_id = ? AND stats.month_key = ?
    ORDER BY stats.messages DESC, users.username COLLATE NOCASE ASC
    LIMIT ?
  `).all(String(guildId), String(requestedMonthKey), Math.max(1, Math.floor(Number(limit) || 5)))
    .map((row, index) => ({
      id: row.id,
      username: row.username || `usuario-${row.id}`,
      messages: Number(row.messages) || 0,
      position: index + 1,
    }));
}

function getLifetimeMessageLeaderboard(limit = 10) {
  return db.prepare(`
    SELECT id, username, messages_count AS messages
    FROM usuarios
    WHERE messages_count > 0
    ORDER BY messages_count DESC, username COLLATE NOCASE ASC
    LIMIT ?
  `).all(Math.max(1, Math.floor(Number(limit) || 10)))
    .map((row, index) => ({
      id: row.id,
      username: row.username || `usuario-${row.id}`,
      messages: Number(row.messages) || 0,
      position: index + 1,
    }));
}

module.exports = { getLifetimeMessageLeaderboard, getMonthlyMessageLeaderboard, getWeeklyMessageLeaderboard, monthKey, recordMessage };
