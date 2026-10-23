const db = require("./db");

function setAfk(guildId, userId, reason) {
  const createdAt = Date.now();

  db.prepare(`
    INSERT INTO afk_status (guild_id, user_id, reason, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id)
    DO UPDATE SET
      reason = excluded.reason,
      created_at = excluded.created_at
  `).run(String(guildId), String(userId), String(reason || "AFK"), createdAt);

  return {
    guildId: String(guildId),
    userId: String(userId),
    reason: String(reason || "AFK"),
    createdAt,
  };
}

function getAfk(guildId, userId) {
  const row = db.prepare(`
    SELECT reason, created_at AS createdAt
    FROM afk_status
    WHERE guild_id = ? AND user_id = ?
  `).get(String(guildId), String(userId));

  if (!row) return null;

  return {
    guildId: String(guildId),
    userId: String(userId),
    reason: row.reason,
    createdAt: Number(row.createdAt) || Date.now(),
  };
}

function removeAfk(guildId, userId) {
  const current = getAfk(guildId, userId);

  db.prepare("DELETE FROM afk_status WHERE guild_id = ? AND user_id = ?")
    .run(String(guildId), String(userId));

  return current;
}

module.exports = {
  getAfk,
  removeAfk,
  setAfk,
};
