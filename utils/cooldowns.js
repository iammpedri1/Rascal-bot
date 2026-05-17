const db = require("./db");

const DURATIONS = {
  daily: 24 * 60 * 60 * 1000,
  trabalhar: 3 * 60 * 60 * 1000,
  roubar: 60 * 60 * 1000,
  bonus: 7 * 24 * 60 * 60 * 1000,
  rep: 12 * 60 * 60 * 1000,
};

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

function get(userId, command) {
  const row = db.prepare(`
    SELECT expira_em AS expiresAt
    FROM cooldowns
    WHERE user_id = ? AND comando = ?
  `).get(String(userId), command);

  if (!row) return { ready: true, remaining: 0, expiresAt: 0 };

  const now = Date.now();
  const maxDuration = DURATIONS[command];
  let expiresAt = row.expiresAt;

  if (maxDuration && expiresAt > now + maxDuration) {
    expiresAt = now + maxDuration;
    db.prepare("UPDATE cooldowns SET expira_em = ? WHERE user_id = ? AND comando = ?")
      .run(expiresAt, String(userId), command);
  }

  const remaining = expiresAt - now;
  if (remaining <= 0) {
    clear(userId, command);
    return { ready: true, remaining: 0, expiresAt: 0 };
  }

  return {
    ready: false,
    remaining,
    expiresAt,
  };
}

function set(userId, command, duration = DURATIONS[command]) {
  const expiresAt = Date.now() + duration;

  db.prepare(`
    INSERT INTO cooldowns (user_id, comando, expira_em)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, comando)
    DO UPDATE SET expira_em = excluded.expira_em
  `).run(String(userId), command, expiresAt);

  return expiresAt;
}

function clear(userId, command) {
  db.prepare("DELETE FROM cooldowns WHERE user_id = ? AND comando = ?")
    .run(String(userId), command);
}

function check(userId, command) {
  return get(userId, command);
}

function consume(userId, command) {
  return set(userId, command, DURATIONS[command]);
}

function allForUser(userId) {
  return {
    daily: get(userId, "daily"),
    work: get(userId, "trabalhar"),
    rob: get(userId, "roubar"),
    bonus: get(userId, "bonus"),
    rep: get(userId, "rep"),
  };
}

module.exports = {
  DURATIONS,
  allForUser,
  check,
  clear,
  consume,
  formatDuration,
  get,
  set,
};
