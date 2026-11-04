
const db = require("./db");
const { getUser, addBalance, updateStats, pushTransaction } = require("./cookieEconomy");
const logger = require("./logger");
const { getPrimaryGuild } = require("./primaryGuild");

const activeSessions = new Map();
const VOICE_REWARD_INTERVAL_MS = 10 * 60 * 1000;
let rewardSchedulerStarted = false;
const addVoiceSecondsStmt = db.prepare(`
  INSERT INTO voice_weekly_stats (guild_id, user_id, week_key, seconds, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(guild_id, user_id, week_key)
  DO UPDATE SET
    seconds = seconds + excluded.seconds,
    updated_at = excluded.updated_at
`);
const addDailyVoiceSecondsStmt = db.prepare(`
  INSERT INTO voice_daily_stats (guild_id, user_id, day_key, seconds, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(guild_id, user_id, day_key)
  DO UPDATE SET seconds = seconds + excluded.seconds, updated_at = excluded.updated_at
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
const monthlyVoiceLeaderboardStmt = db.prepare(`
  SELECT voice.user_id AS id, users.username AS username, voice.seconds AS seconds
  FROM voice_monthly_stats voice
  LEFT JOIN usuarios users ON users.id = voice.user_id
  WHERE voice.guild_id = ? AND voice.month_key = ?
  ORDER BY voice.seconds DESC, users.username COLLATE NOCASE ASC
  LIMIT ?
`);
const addTransmissionSecondsStmt = db.prepare(`
  INSERT INTO transmission_weekly_stats (guild_id, user_id, week_key, seconds, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(guild_id, user_id, week_key)
  DO UPDATE SET seconds = seconds + excluded.seconds, updated_at = excluded.updated_at
`);
const weeklyTransmissionLeaderboardStmt = db.prepare(`
  SELECT stats.user_id AS id, users.username AS username, stats.seconds AS seconds
  FROM transmission_weekly_stats stats
  LEFT JOIN usuarios users ON users.id = stats.user_id
  WHERE stats.guild_id = ? AND stats.week_key = ?
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

function monthParts(now = Date.now()) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23", timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date(now)).map(part => [part.type, part.value]));
}

function localDateParts(now = Date.now()) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23", timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date(now)).map(part => [part.type, part.value]));
}

function dayKey(now = Date.now()) {
  const parts = localDateParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localDayStartMs(now = Date.now(), daysFromToday = 0) {
  const parts = localDateParts(now);
  const localMidnightAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day) + daysFromToday
  );
  const approximate = localMidnightAsUtc + 12 * 60 * 60 * 1000;
  const atApproximate = localDateParts(approximate);
  const representedUtc = Date.UTC(
    Number(atApproximate.year), Number(atApproximate.month) - 1, Number(atApproximate.day),
    Number(atApproximate.hour), Number(atApproximate.minute), Number(atApproximate.second)
  );
  const offset = representedUtc - approximate;
  return localMidnightAsUtc - offset;
}

function monthKey(now = Date.now()) {
  const parts = monthParts(now);
  return `${parts.year}-${parts.month}`;
}

function nextMonthStartMs(now) {
  const parts = monthParts(now);
  let year = Number(parts.year);
  let month = Number(parts.month);
  if (month === 12) { year += 1; month = 1; } else month += 1;
  const localStartAsUtc = Date.UTC(year, month - 1, 1, 0, 0, 0);
  const approximate = localStartAsUtc + 12 * 60 * 60 * 1000;
  const atApproximate = monthParts(approximate);
  const representedUtc = Date.UTC(
    Number(atApproximate.year), Number(atApproximate.month) - 1, Number(atApproximate.day),
    Number(atApproximate.hour), Number(atApproximate.minute), Number(atApproximate.second)
  );
  const offset = representedUtc - Math.floor(approximate / 1000) * 1000;
  return localStartAsUtc - offset;
}

function nextWeekStartMs(startMs) {
  return startMs + 7 * 24 * 60 * 60 * 1000;
}

function addVoiceSeconds(guildId, userId, seconds, now = Date.now()) {
  const safeSeconds = Math.max(0, integer(seconds));
  if (!safeSeconds) return;

  addVoiceSecondsStmt.run(String(guildId), String(userId), weekKey(now), safeSeconds, now);
  addDailyVoiceSecondsStmt.run(String(guildId), String(userId), dayKey(now), safeSeconds, now);
  db.prepare(`
    INSERT INTO voice_monthly_stats (guild_id, user_id, month_key, seconds, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id, month_key)
    DO UPDATE SET seconds = seconds + excluded.seconds, updated_at = excluded.updated_at
  `).run(String(guildId), String(userId), monthKey(now), safeSeconds, now);
}

function addVoiceRange(guildId, userId, startedAt, endedAt = Date.now()) {
  let cursor = Math.max(0, integer(startedAt));
  const end = Math.max(cursor, integer(endedAt));

  while (cursor < end) {
    const currentWeekStart = weekStartMs(cursor);
    const chunkEnd = Math.min(
      end,
      nextWeekStartMs(currentWeekStart),
      nextMonthStartMs(cursor),
      localDayStartMs(cursor, 1)
    );
    const seconds = Math.floor((chunkEnd - cursor) / 1000);

    addVoiceSeconds(guildId, userId, seconds, cursor);
    cursor = chunkEnd;
  }
}

function addTransmissionRange(guildId, userId, startedAt, endedAt = Date.now()) {
  let cursor = Math.max(0, integer(startedAt));
  const end = Math.max(cursor, integer(endedAt));

  while (cursor < end) {
    const currentWeekStart = weekStartMs(cursor);
    const chunkEnd = Math.min(end, nextWeekStartMs(currentWeekStart));
    const seconds = Math.floor((chunkEnd - cursor) / 1000);

    if (seconds > 0) {
      addTransmissionSecondsStmt.run(
        String(guildId), String(userId), weekKey(cursor), seconds, cursor
      );
    }
    cursor = chunkEnd;
  }
}

function getVoiceTime(guildId, userId, now = Date.now()) {
  const guild = String(guildId);
  const user = String(userId);
  const todayStart = localDayStartMs(now);
  const weekStart = weekStartMs(now);
  const currentMonth = monthKey(now);
  const daily = db.prepare(`
    SELECT seconds FROM voice_daily_stats WHERE guild_id = ? AND user_id = ? AND day_key = ?
  `).get(guild, user, dayKey(now));
  const weekly = db.prepare(`
    SELECT seconds FROM voice_weekly_stats WHERE guild_id = ? AND user_id = ? AND week_key = ?
  `).get(guild, user, weekKey(now));
  const monthly = db.prepare(`
    SELECT seconds FROM voice_monthly_stats WHERE guild_id = ? AND user_id = ? AND month_key = ?
  `).get(guild, user, currentMonth);
  const lifetime = db.prepare(`
    SELECT COALESCE(SUM(seconds), 0) AS seconds
    FROM voice_monthly_stats WHERE guild_id = ? AND user_id = ?
  `).get(guild, user);

  const active = activeSessions.get(sessionKey(guild, user));
  const currentSession = active ? Math.max(0, Math.floor((now - active.startedAt) / 1000)) : 0;
  const activeToday = active ? Math.max(0, Math.floor((now - Math.max(active.startedAt, todayStart)) / 1000)) : 0;
  const activeThisWeek = active ? Math.max(0, Math.floor((now - Math.max(active.startedAt, weekStart)) / 1000)) : 0;
  const activeThisMonth = active ? Math.max(0, Math.floor((now - Math.max(active.startedAt, localMonthStartMs(now))) / 1000)) : 0;

  return {
    today: integer(daily?.seconds) + activeToday,
    week: integer(weekly?.seconds) + activeThisWeek,
    month: integer(monthly?.seconds) + activeThisMonth,
    total: integer(lifetime?.seconds) + currentSession,
  };
}

function localMonthStartMs(now = Date.now()) {
  const parts = monthParts(now);
  const localMidnightAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, 1);
  const approximate = localMidnightAsUtc + 12 * 60 * 60 * 1000;
  const atApproximate = monthParts(approximate);
  const representedUtc = Date.UTC(
    Number(atApproximate.year), Number(atApproximate.month) - 1, Number(atApproximate.day),
    Number(atApproximate.hour), Number(atApproximate.minute), Number(atApproximate.second)
  );
  const offset = representedUtc - approximate;
  return localMidnightAsUtc - offset;
}

function voiceEligible(member) {
  return Boolean(member?.voice?.channelId) && !member.voice.selfMute && !member.voice.serverMute;
}

function startVoiceSession(member, channelId, startedAt = Date.now(), resetRewardEligibility = false) {
  if (!member?.guild || member.user?.bot || !channelId) return;

  const state = db.prepare(`
    SELECT eligible_since AS eligibleSince, last_reward_at AS lastRewardAt
    FROM voice_reward_state WHERE guild_id = ? AND user_id = ?
  `).get(String(member.guild.id), String(member.id));
  const eligibleSince = voiceEligible(member)
    ? (resetRewardEligibility ? startedAt : integer(state?.eligibleSince, startedAt) || startedAt)
    : null;
  db.prepare(`
    INSERT INTO voice_reward_state (guild_id, user_id, eligible_since, last_reward_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET eligible_since = excluded.eligible_since
  `).run(String(member.guild.id), String(member.id), eligibleSince, state?.lastRewardAt || null);

  activeSessions.set(sessionKey(member.guild.id, member.id), {
    guildId: member.guild.id,
    userId: member.id,
    username: member.user.username,
    channelId,
    startedAt,
    eligibleSince,
    streamStartedAt: member.voice?.streaming ? startedAt : null,
  });
}

function updateVoiceStreaming(member, streaming = member?.voice?.streaming, now = Date.now()) {
  if (!member?.guild || member.user?.bot) return;

  const key = sessionKey(member.guild.id, member.id);
  let session = activeSessions.get(key);
  if (!session && member.voice?.channelId) {
    startVoiceSession(member, member.voice.channelId, now);
    session = activeSessions.get(key);
  }
  if (!session) return;

  if (streaming && !session.streamStartedAt) {
    session.streamStartedAt = now;
  } else if (!streaming && session.streamStartedAt) {
    addTransmissionRange(session.guildId, session.userId, session.streamStartedAt, now);
    session.streamStartedAt = null;
  }
}

function updateVoiceEligibility(member, now = Date.now()) {
  if (!member?.guild || member.user?.bot) return;
  const session = activeSessions.get(sessionKey(member.guild.id, member.id));
  if (!session) return;
  const eligibleSince = voiceEligible(member)
    ? (session.eligibleSince || now)
    : null;
  session.eligibleSince = eligibleSince;
  db.prepare(`
    INSERT INTO voice_reward_state (guild_id, user_id, eligible_since, last_reward_at)
    VALUES (?, ?, ?, NULL)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET eligible_since = excluded.eligible_since
  `).run(String(member.guild.id), String(member.id), eligibleSince);
}

function stopVoiceSession(member, endedAt = Date.now()) {
  if (!member?.guild) return;

  const key = sessionKey(member.guild.id, member.id);
  const session = activeSessions.get(key);
  if (!session) return;

  activeSessions.delete(key);
  addVoiceRange(session.guildId, session.userId, session.startedAt, endedAt);
  if (session.streamStartedAt) {
    addTransmissionRange(session.guildId, session.userId, session.streamStartedAt, endedAt);
  }
  db.prepare(`UPDATE voice_reward_state SET eligible_since = NULL WHERE guild_id = ? AND user_id = ?`)
    .run(String(session.guildId), String(session.userId));
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
  const guild = getPrimaryGuild(client);
  if (guild) syncActiveVoiceSessions(guild, now);
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
        updateVoiceEligibility(member, now);
        updateVoiceStreaming(member, member.voice?.streaming, now);
        continue;
      }

      startVoiceSession(member, channel.id, now, true);
    }
  }

  for (const [key, session] of activeSessions.entries()) {
    if (session.guildId !== String(guild.id) || liveKeys.has(key)) continue;

    activeSessions.delete(key);
    addVoiceRange(session.guildId, session.userId, session.startedAt, now);
    if (session.streamStartedAt) {
      addTransmissionRange(session.guildId, session.userId, session.streamStartedAt, now);
    }
  }
}

function persistActiveVoiceSessions(guild, now = Date.now()) {
  for (const session of activeSessions.values()) {
    if (session.guildId !== String(guild.id)) continue;
    addVoiceRange(session.guildId, session.userId, session.startedAt, now);
    session.startedAt = now;
    if (session.streamStartedAt) {
      addTransmissionRange(session.guildId, session.userId, session.streamStartedAt, now);
      session.streamStartedAt = now;
    }
  }
}

function activeSecondsForCurrentWeek(session, now = Date.now()) {
  const start = Math.max(session.startedAt, weekStartMs(now));
  return Math.max(0, Math.floor((now - start) / 1000));
}

function getWeeklyVoiceLeaderboard(guildId, limit = 10) {
  const now = Date.now();
  const rows = weeklyVoiceLeaderboardStmt.all(String(guildId), weekKey(now)) as Array<{ id: string; username: string; seconds: number }>;
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

function getWeeklyTransmissionLeaderboard(guildId, limit = 500, now = Date.now()) {
  const byUser = new Map((weeklyTransmissionLeaderboardStmt.all(String(guildId), weekKey(now)) as Array<{ id: string; username: string; seconds: number }>)
    .map(row => [row.id, {
      id: row.id,
      username: row.username || `usuario-${row.id}`,
      seconds: integer(row.seconds),
    }]));

  for (const session of activeSessions.values()) {
    if (session.guildId !== String(guildId) || !session.streamStartedAt) continue;

    const current = byUser.get(session.userId) || {
      id: session.userId,
      username: session.username || `usuario-${session.userId}`,
      seconds: 0,
    };
    current.username = session.username || current.username;
    current.seconds += Math.max(0, Math.floor((now - Math.max(session.streamStartedAt, weekStartMs(now))) / 1000));
    byUser.set(session.userId, current);
  }

  return [...byUser.values()]
    .filter(item => item.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds || a.username.localeCompare(b.username, "pt-BR"))
    .slice(0, Math.max(1, integer(limit, 500)))
    .map((item, index) => ({ ...item, position: index + 1 }));
}

function getMonthlyVoiceLeaderboard(guildId, requestedMonthKey, limit = 5) {
  const now = Date.now();
  for (const session of activeSessions.values()) {
    if (session.guildId !== String(guildId) || session.startedAt >= now) continue;
    addVoiceRange(session.guildId, session.userId, session.startedAt, now);
    session.startedAt = now;
  }
  return (monthlyVoiceLeaderboardStmt.all(
    String(guildId), String(requestedMonthKey), Math.max(1, integer(limit, 5))
  ) as Array<{ id: string; username: string; seconds: number }>).map((row, index) => ({
    id: row.id,
    username: row.username || `usuario-${row.id}`,
    seconds: integer(row.seconds),
    position: index + 1,
  }));
}

function payVoiceRewards(now = Date.now()) {
  for (const session of activeSessions.values()) {
    if (!session.eligibleSince || now - session.eligibleSince < VOICE_REWARD_INTERVAL_MS) continue;
    const reward = 1 + Math.floor(Math.random() * 5);
    const user = { id: session.userId, username: session.username };
    getUser(user);
    addBalance(session.userId, reward);
    updateStats(session.userId, { cookies_won: reward, total_earned: reward });
    pushTransaction("voice_reward", session.userId, reward, {
      guildId: session.guildId,
      note: "10 minutos em canal de voz sem mute",
    });
    const lastRewardAt = now;
    session.eligibleSince = now;
    db.prepare(`
      UPDATE voice_reward_state SET eligible_since = ?, last_reward_at = ?
      WHERE guild_id = ? AND user_id = ?
    `).run(now, lastRewardAt, session.guildId, session.userId);
  }
}

function startVoiceRewardScheduler() {
  if (rewardSchedulerStarted) return;
  rewardSchedulerStarted = true;
  const timer = setInterval(() => {
    try { payVoiceRewards(); } catch (error) { logger.error("Falha ao pagar recompensa por voz", error); }
  }, 60 * 1000);
  timer.unref?.();
}

function forgetVoiceUser(userId) {
  const id = String(userId);
  for (const [key, session] of activeSessions.entries()) {
    if (session.userId === id) activeSessions.delete(key);
  }
}

module.exports = {
  forgetVoiceUser,
  getVoiceTime,
  getMonthlyVoiceLeaderboard,
  getWeeklyTransmissionLeaderboard,
  getWeeklyVoiceLeaderboard,
  monthKey,
  moveVoiceSession,
  persistActiveVoiceSessions,
  startVoiceRewardScheduler,
  seedActiveVoiceSessions,
  startVoiceSession,
  stopVoiceSession,
  syncActiveVoiceSessions,
  updateVoiceEligibility,
  updateVoiceStreaming,
};
