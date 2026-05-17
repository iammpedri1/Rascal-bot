const db = require("./db");

const activeSessions = new Map();
const addVoiceSecondsStmt = db.prepare(`
  INSERT INTO voice_weekly_stats (guild_id, user_id, week_key, seconds, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(guild_id, user_id, week_key)
  DO UPDATE SET
    seconds = seconds + excluded.seconds,
    updated_at = excluded.updated_at
`);
const weeklyVoiceLeaderboardStmt = db.prepare(`
  SELECT
    voice.user_id AS id,
    users.username AS username,
    voice.seconds AS seconds
  FROM voice_weekly_stats voice
  LEFT JOIN usuarios users ON users.id = voice.user_id
  WHERE voice.guild_id = ? AND voice.week_key = ?
`);

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function sessionKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function weekStartMs(now = Date.now()) {
  const date = new Date(now);
  const dayFromMonday = (date.getUTCDay() + 6) % 7;

  date.setUTCDate(date.getUTCDate() - dayFromMonday);
  date.setUTCHours(0, 0, 0, 0);

  return date.getTime();
}

function weekKey(now = Date.now()) {
  return new Date(weekStartMs(now)).toISOString().slice(0, 10);
}

function nextWeekStartMs(startMs) {
  return startMs + 7 * 24 * 60 * 60 * 1000;
}

function addVoiceSeconds(guildId, userId, seconds, now = Date.now()) {
  const safeSeconds = Math.max(0, integer(seconds));
  if (!safeSeconds) return;

  addVoiceSecondsStmt.run(String(guildId), String(userId), weekKey(now), safeSeconds, now);
}

function addVoiceRange(guildId, userId, startedAt, endedAt = Date.now()) {
  let cursor = Math.max(0, integer(startedAt));
  const end = Math.max(cursor, integer(endedAt));

  while (cursor < end) {
    const currentWeekStart = weekStartMs(cursor);
    const chunkEnd = Math.min(end, nextWeekStartMs(currentWeekStart));
    const seconds = Math.floor((chunkEnd - cursor) / 1000);

    addVoiceSeconds(guildId, userId, seconds, cursor);
    cursor = chunkEnd;
  }
}

function startVoiceSession(member, channelId, startedAt = Date.now()) {
  if (!member?.guild || member.user?.bot || !channelId) return;

  activeSessions.set(sessionKey(member.guild.id, member.id), {
    guildId: member.guild.id,
    userId: member.id,
    username: member.user.username,
    channelId,
    startedAt,
  });
}

function stopVoiceSession(member, endedAt = Date.now()) {
  if (!member?.guild) return;

  const key = sessionKey(member.guild.id, member.id);
  const session = activeSessions.get(key);
  if (!session) return;

  activeSessions.delete(key);
  addVoiceRange(session.guildId, session.userId, session.startedAt, endedAt);
}

function moveVoiceSession(member, channelId) {
  if (!member?.guild || member.user?.bot || !channelId) return;

  const key = sessionKey(member.guild.id, member.id);
  const session = activeSessions.get(key);

  if (session) {
    session.channelId = channelId;
    session.username = member.user.username;
    return;
  }

  startVoiceSession(member, channelId);
}

function seedActiveVoiceSessions(client) {
  const now = Date.now();

  for (const guild of client.guilds.cache.values()) {
    syncActiveVoiceSessions(guild, now);
  }
}

function syncActiveVoiceSessions(guild, now = Date.now()) {
  if (!guild?.id) return;

  const liveKeys = new Set();

  for (const channel of guild.channels.cache.values()) {
    if (!channel.members) continue;

    for (const member of channel.members.values()) {
      if (member.user?.bot) continue;

      const key = sessionKey(guild.id, member.id);
      const session = activeSessions.get(key);

      liveKeys.add(key);

      if (session) {
        session.channelId = channel.id;
        session.username = member.user.username;
        continue;
      }

      startVoiceSession(member, channel.id, now);
    }
  }

  for (const [key, session] of activeSessions.entries()) {
    if (session.guildId !== String(guild.id) || liveKeys.has(key)) continue;

    activeSessions.delete(key);
    addVoiceRange(session.guildId, session.userId, session.startedAt, now);
  }
}

function activeSecondsForCurrentWeek(session, now = Date.now()) {
  const start = Math.max(session.startedAt, weekStartMs(now));
  return Math.max(0, Math.floor((now - start) / 1000));
}

function getWeeklyVoiceLeaderboard(guildId, limit = 10) {
  const now = Date.now();
  const rows = weeklyVoiceLeaderboardStmt.all(String(guildId), weekKey(now));
  const byUser = new Map(rows.map(row => [row.id, {
    id: row.id,
    username: row.username || `usuario-${row.id}`,
    seconds: integer(row.seconds),
  }]));

  for (const session of activeSessions.values()) {
    if (session.guildId !== String(guildId)) continue;

    const current = byUser.get(session.userId) || {
      id: session.userId,
      username: session.username || `usuario-${session.userId}`,
      seconds: 0,
    };

    current.username = session.username || current.username;
    current.seconds += activeSecondsForCurrentWeek(session, now);
    byUser.set(session.userId, current);
  }

  return [...byUser.values()]
    .filter(item => item.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds || a.username.localeCompare(b.username, "pt-BR"))
    .slice(0, Math.max(1, integer(limit, 10)))
    .map((item, index) => ({
      ...item,
      position: index + 1,
    }));
}

module.exports = {
  getWeeklyVoiceLeaderboard,
  moveVoiceSession,
  seedActiveVoiceSessions,
  startVoiceSession,
  stopVoiceSession,
  syncActiveVoiceSessions,
};
