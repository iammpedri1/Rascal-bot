const db = require("./db");

const XP_COOLDOWN = 60 * 1000;
const MIN_XP = 15;
const MAX_XP = 28;
const cooldowns = new Map();

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function randomXp() {
  return MIN_XP + Math.floor(Math.random() * (MAX_XP - MIN_XP + 1));
}

function xpForLevel(level) {
  return Math.max(0, level * level * 100);
}

function levelFromXp(xp) {
  return Math.floor(Math.sqrt(integer(xp) / 100));
}

function progressFromXp(xp) {
  const totalXp = integer(xp);
  const level = levelFromXp(totalXp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progress = totalXp - currentLevelXp;
  const needed = nextLevelXp - currentLevelXp;

  return {
    level,
    totalXp,
    progress,
    needed,
    nextLevelXp,
    percent: needed > 0 ? Math.min(100, Math.floor((progress / needed) * 100)) : 100,
  };
}

function ensureUser(user) {
  const now = Date.now();

  db.prepare(`
    INSERT INTO usuarios (id, username, cookies, xp, created_at, updated_at)
    VALUES (?, ?, 100, 0, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      updated_at = excluded.updated_at
  `).run(String(user.id), user.username || "Usuario", now, now);
}

function getXp(userId) {
  const row = db.prepare("SELECT xp FROM usuarios WHERE id = ?").get(String(userId));
  return progressFromXp(row?.xp || 0);
}

function addUserXp(user, amount) {
  ensureUser(user);
  const gained = Math.max(0, integer(amount));
  const beforeRow = db.prepare("SELECT xp FROM usuarios WHERE id = ?").get(String(user.id));
  const before = progressFromXp(beforeRow?.xp || 0);

  db.prepare("UPDATE usuarios SET xp = xp + ?, updated_at = ? WHERE id = ?")
    .run(gained, Date.now(), String(user.id));

  const after = getXp(user.id);

  return {
    gained,
    before,
    after,
    leveledUp: after.level > before.level,
  };
}

function addMessageXp(message) {
  if (!message.guild || message.author.bot) return null;

  ensureUser(message.author);
  db.prepare("UPDATE usuarios SET messages_count = messages_count + 1, updated_at = ? WHERE id = ?")
    .run(Date.now(), String(message.author.id));

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const last = cooldowns.get(key) || 0;

  if (now - last < XP_COOLDOWN) return null;
  cooldowns.set(key, now);

  return addUserXp(message.author, randomXp());
}

module.exports = {
  addMessageXp,
  addUserXp,
  getXp,
  levelFromXp,
  progressFromXp,
  xpForLevel,
};
