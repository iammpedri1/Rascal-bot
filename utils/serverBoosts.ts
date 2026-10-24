import type { GuildMember } from "discord.js";
import type { SqliteDatabase } from "./sqliteTypes";

const db = require("./db") as SqliteDatabase;
const economy = require("./cookieEconomy") as {
  getProfile(user: GuildMember["user"]): unknown;
  addBalance(userId: string, amount: number): void;
  updateStats(userId: string, changes: Record<string, number>): void;
  pushTransaction(type: string, userId: string, amount: number, details: Record<string, unknown>): void;
};

export const BOOST_WELCOME_BONUS = 25_000;

/** Grants the permanent daily x2 and welcome cookies once per account/server. */
export function awardFirstServerBoost(member: GuildMember): boolean {
  economy.getProfile(member.user);

  return db.transaction(() => {
    const result = db.prepare(`
      INSERT OR IGNORE INTO server_boost_rewards (guild_id, user_id, awarded_at, bonus_cookies)
      VALUES (?, ?, ?, ?)
    `).run(member.guild.id, member.id, Date.now(), BOOST_WELCOME_BONUS);

    if (result.changes === 0) return false;

    economy.addBalance(member.id, BOOST_WELCOME_BONUS);
    economy.updateStats(member.id, {
      cookies_won: BOOST_WELCOME_BONUS,
      total_earned: BOOST_WELCOME_BONUS,
    });
    economy.pushTransaction("boost_welcome_bonus", member.id, BOOST_WELCOME_BONUS, {
      guildId: member.guild.id,
      guildName: member.guild.name,
      note: "Bônus único pelo primeiro impulso do servidor",
    });

    return true;
  })();
}
