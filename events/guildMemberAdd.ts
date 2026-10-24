const db = require("../utils/db");
const logger = require("../utils/logger");
const { isPrimaryGuild } = require("../utils/primaryGuild");
const { activateRaidLockdown } = require("../utils/raidLockdown");
const { isRaidModeEnabled } = require("../utils/raidMode");

function positiveEnvInt(name, fallback, minimum) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value >= minimum ? value : fallback;
}

const JOIN_WINDOW_MS = positiveEnvInt("RAID_JOIN_WINDOW_MS", 5_000, 1_000);
const JOIN_THRESHOLD = positiveEnvInt("RAID_JOIN_THRESHOLD", 11, 2);
const HISTORY_MS = 24 * 60 * 60 * 1000;

module.exports = {
  name: "guildMemberAdd",
  async execute(member) {
    if (!isPrimaryGuild(member.guild.id)) return;

    const now = Date.now();
    db.prepare(`
      INSERT INTO raid_join_events (guild_id, user_id, is_bot, joined_at)
      VALUES (?, ?, ?, ?)
    `).run(String(member.guild.id), String(member.id), member.user.bot ? 1 : 0, now);
    db.prepare("DELETE FROM raid_join_events WHERE guild_id = ? AND joined_at < ?")
      .run(String(member.guild.id), now - HISTORY_MS);

    if (!member.user.bot) {
      db.prepare(`
        INSERT INTO guild_memberships (guild_id, user_id, joined_at, left_at)
        VALUES (?, ?, ?, NULL)
        ON CONFLICT(guild_id, user_id) DO UPDATE SET joined_at = excluded.joined_at, left_at = NULL
      `).run(String(member.guild.id), String(member.id), now);
    }

    const recent = Number(db.prepare(`
      SELECT COUNT(*) AS total FROM raid_join_events
      WHERE guild_id = ? AND joined_at >= ?
    `).get(String(member.guild.id), now - JOIN_WINDOW_MS).total);

    if (recent < JOIN_THRESHOLD || isRaidModeEnabled(member.guild.id)) return;
    try {
      const result = await activateRaidLockdown(member.guild, {
        activatedBy: "anti-raid-automatico",
        reason: `${recent} entradas em ${Math.ceil(JOIN_WINDOW_MS / 1000)} segundos (limite: ${JOIN_THRESHOLD})`,
      });
      if (!result.alreadyActive) {
        logger.warn("Pico de entradas acionou lockdown automático", {
          guildId: member.guild.id,
          recentJoins: recent,
          threshold: JOIN_THRESHOLD,
          windowMs: JOIN_WINDOW_MS,
        });
      }
    } catch (error) {
      logger.error("Falha ao ativar lockdown anti-raid automático", error, { guildId: member.guild.id, recentJoins: recent });
    }
  },
};
