const db = require("./db");

const XP_CONFIG = {
  cooldownMs: 45 * 1000,
  minMessageLength: 8,
  baseMin: 18,
  baseMax: 32,
  burstWindowMs: 20 * 1000,
  burstLimit: 5,
  repeatWindowMs: 5 * 60 * 1000,
  streakWindowMs: 10 * 60 * 1000,
  dailySoftCap: 900,
  dailyHardCap: 1400,
};

const activity = new Map();

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function normalizeContent(content) {
  return String(content || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " link ")
    .replace(/<a?:\w+:\d+>/g, " emoji ")
    .replace(/<@!?\d+>|<#\d+>|<@&\d+>/g, " mention ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueWordCount(content) {
  const words = normalizeContent(content)
    .split(" ")
    .filter(word => word.length >= 3 && !/^\d+$/.test(word));

  return new Set(words).size;
}

function xpForLevel(level) {
  const safeLevel = Math.max(0, integer(level));
  return Math.floor((safeLevel * safeLevel * 85) + (safeLevel * 75));
}

function levelFromXp(xp) {
  const totalXp = integer(xp);
  let level = 0;

  while (xpForLevel(level + 1) <= totalXp) level += 1;
  return level;
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
    remaining: Math.max(0, needed - progress),
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

function getXpRank(userId, totalXp) {
  const row = db.prepare("SELECT COUNT(*) + 1 AS position FROM usuarios WHERE xp > ?").get(integer(totalXp));
  const total = db.prepare("SELECT COUNT(*) AS total FROM usuarios").get();

  return {
    position: integer(row?.position, 1),
    total: Math.max(1, integer(total?.total, 0)),
  };
}

function getXpLeaderboard(limit = 100) {
  return db.prepare(`
    SELECT id, username, xp, messages_count AS messagesCount
    FROM usuarios
    WHERE xp > 0
    ORDER BY xp DESC, messages_count DESC
    LIMIT ?
  `).all(Math.max(1, integer(limit, 100))).map((row, index) => ({
    id: row.id,
    username: row.username || `usuario-${row.id}`,
    messagesCount: integer(row.messagesCount),
    position: index + 1,
    ...progressFromXp(row.xp),
  }));
}

function getXp(userId) {
  const row = db.prepare("SELECT xp, messages_count AS messagesCount FROM usuarios WHERE id = ?")
    .get(String(userId));
  const progress = progressFromXp(row?.xp || 0);

  return {
    ...progress,
    messagesCount: integer(row?.messagesCount),
    rank: getXpRank(userId, progress.totalXp),
  };
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

function setUserXp(user, amount) {
  ensureUser(user);
  const nextXp = Math.max(0, integer(amount));
  const beforeRow = db.prepare("SELECT xp FROM usuarios WHERE id = ?").get(String(user.id));
  const before = progressFromXp(beforeRow?.xp || 0);

  db.prepare("UPDATE usuarios SET xp = ?, updated_at = ? WHERE id = ?")
    .run(nextXp, Date.now(), String(user.id));

  const after = getXp(user.id);

  return {
    changedBy: after.totalXp - before.totalXp,
    before,
    after,
    leveledUp: after.level > before.level,
  };
}

function stateFor(key, now) {
  const state = activity.get(key) || {
    lastXpAt: 0,
    lastNormalized: "",
    lastMessageAt: 0,
    streak: 0,
    messages: [],
    earnedToday: 0,
    day: dayKey(now),
  };

  if (state.day !== dayKey(now)) {
    state.day = dayKey(now);
    state.earnedToday = 0;
    state.streak = 0;
    state.messages = [];
  }

  activity.set(key, state);
  return state;
}

function calculateMessageXp(message, state, now) {
  const normalized = normalizeContent(message.content);
  const length = normalized.length;
  const uniqueWords = uniqueWordCount(message.content);
  const hasAttachment = message.attachments?.size > 0;
  const hasSticker = message.stickers?.size > 0;

  if (!hasAttachment && !hasSticker && length < XP_CONFIG.minMessageLength) {
    return { allowed: false, reason: "Mensagem curta demais." };
  }

  if (normalized && normalized === state.lastNormalized && now - state.lastMessageAt < XP_CONFIG.repeatWindowMs) {
    return { allowed: false, reason: "Mensagem repetida." };
  }

  state.messages = state.messages.filter(timestamp => now - timestamp < XP_CONFIG.burstWindowMs);
  if (state.messages.length >= XP_CONFIG.burstLimit) {
    return { allowed: false, reason: "Muitas mensagens em pouco tempo." };
  }

  if (now - state.lastXpAt < XP_CONFIG.cooldownMs) {
    return { allowed: false, reason: "Cooldown de XP ativo." };
  }

  const base = randomInt(XP_CONFIG.baseMin, XP_CONFIG.baseMax);
  const lengthBonus = clamp(Math.floor(length / 32), 0, 10);
  const wordBonus = clamp(Math.floor(uniqueWords / 4), 0, 8);
  const mediaBonus = hasAttachment || hasSticker ? 5 : 0;
  const replyBonus = message.reference ? 3 : 0;

  const keepsStreak = state.lastXpAt && now - state.lastXpAt <= XP_CONFIG.streakWindowMs;
  const streak = keepsStreak ? state.streak + 1 : 1;
  const streakMultiplier = 1 + clamp(streak - 1, 0, 6) * 0.025;

  let gained = Math.floor((base + lengthBonus + wordBonus + mediaBonus + replyBonus) * streakMultiplier);

  if (state.earnedToday >= XP_CONFIG.dailySoftCap) gained = Math.floor(gained * 0.45);
  if (state.earnedToday >= XP_CONFIG.dailyHardCap) {
    return { allowed: false, reason: "Limite diario de XP atingido." };
  }

  return {
    allowed: true,
    gained: clamp(gained, 8, 55),
    streak,
    breakdown: {
      base,
      lengthBonus,
      wordBonus,
      mediaBonus,
      replyBonus,
    },
  };
}

function addMessageXp(message) {
  if (!message.guild || message.author.bot || message.webhookId || message.system) return null;
  if (message.content?.startsWith("/") || message.content?.startsWith("!")) return null;

  ensureUser(message.author);
  db.prepare("UPDATE usuarios SET messages_count = messages_count + 1, updated_at = ? WHERE id = ?")
    .run(Date.now(), String(message.author.id));

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const state = stateFor(key, now);
  const reward = calculateMessageXp(message, state, now);
  const normalized = normalizeContent(message.content);

  state.messages.push(now);
  state.lastMessageAt = now;
  if (normalized) state.lastNormalized = normalized;

  if (!reward.allowed) return null;

  state.lastXpAt = now;
  state.streak = reward.streak;
  state.earnedToday += reward.gained;

  return {
    ...addUserXp(message.author, reward.gained),
    streak: reward.streak,
    breakdown: reward.breakdown,
  };
}

module.exports = {
  XP_CONFIG,
  addMessageXp,
  addUserXp,
  getXp,
  getXpLeaderboard,
  levelFromXp,
  progressFromXp,
  setUserXp,
  xpForLevel,
};
