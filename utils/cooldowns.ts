const db = require("./db");

const DURATIONS = {
  daily: 24 * 60 * 60 * 1000,
  trabalhar: 60 * 60 * 1000,
  roubar: 3 * 60 * 60 * 1000,
  bonus: 7 * 24 * 60 * 60 * 1000,
  rep: 12 * 60 * 60 * 1000,
};
const USER_COOLDOWN_COLUMNS = {
  daily: "cooldown_daily",
  trabalhar: "cooldown_trabalhar",
  roubar: "cooldown_roubar",
  bonus: "cooldown_bonus",
  rep: "cooldown_rep",
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

  if (userId === process.env.OWNER_ID) return { ready: true, remaining: 0, expiresAt: 0 };

  const column = USER_COOLDOWN_COLUMNS[command];
  const row = db.prepare(`

    SELECT
      (SELECT expira_em FROM cooldowns WHERE user_id = ? AND comando = ?) AS storedAt,
      ${column ? `(SELECT ${column} FROM usuarios WHERE id = ?)` : "NULL"} AS profileAt
  `).get(...(column ? [String(userId), command, String(userId)] : [String(userId), command]));

  let expiresAt = Number(row?.storedAt || row?.profileAt || 0);
  if (!expiresAt) return { ready: true, remaining: 0, expiresAt: 0 };

  const now = Date.now();
  const maxDuration = DURATIONS[command];

  if (maxDuration && expiresAt > now + maxDuration) {
    expiresAt = now + maxDuration;
    db.prepare("UPDATE cooldowns SET expira_em = ? WHERE user_id = ? AND comando = ?")
      .run(expiresAt, String(userId), command);
    if (column) {
      db.prepare(`UPDATE usuarios SET ${column} = ?, updated_at = ? WHERE id = ?`)
        .run(expiresAt, now, String(userId));
    }
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
  const column = USER_COOLDOWN_COLUMNS[command];
  const save = db.transaction(() => {
    db.prepare(`
      INSERT INTO cooldowns (user_id, comando, expira_em)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, comando)
      DO UPDATE SET expira_em = excluded.expira_em
    `).run(String(userId), command, expiresAt);
    if (column) {
      db.prepare(`UPDATE usuarios SET ${column} = ?, updated_at = ? WHERE id = ?`)
        .run(expiresAt, Date.now(), String(userId));
    }
  });
  save();

  return expiresAt;
}

function clear(userId, command) {
  const column = USER_COOLDOWN_COLUMNS[command];
  const remove = db.transaction(() => {
    db.prepare("DELETE FROM cooldowns WHERE user_id = ? AND comando = ?")
      .run(String(userId), command);
    if (column) {
      db.prepare(`UPDATE usuarios SET ${column} = 0, updated_at = ? WHERE id = ?`)
        .run(Date.now(), String(userId));
    }
  });
  remove();
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
