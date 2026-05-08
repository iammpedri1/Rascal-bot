const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "../data");
const dbFile = path.join(dataDir, "database.sqlite");
const legacyCookiesFile = path.join(dataDir, "cookies.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    username TEXT,
    cookies INTEGER NOT NULL DEFAULT 100,
    reputacao INTEGER NOT NULL DEFAULT 0,
    bet_wins INTEGER NOT NULL DEFAULT 0,
    bet_losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    cookies_won INTEGER NOT NULL DEFAULT 0,
    cookies_lost INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0,
    daily_claims INTEGER NOT NULL DEFAULT 0,
    daily_streak INTEGER NOT NULL DEFAULT 0,
    best_daily_streak INTEGER NOT NULL DEFAULT 0,
    work_count INTEGER NOT NULL DEFAULT 0,
    rob_count INTEGER NOT NULL DEFAULT 0,
    rob_wins INTEGER NOT NULL DEFAULT 0,
    rob_losses INTEGER NOT NULL DEFAULT 0,
    bonus_claims INTEGER NOT NULL DEFAULT 0,
    rifa_wins INTEGER NOT NULL DEFAULT 0,
    rifa_losses INTEGER NOT NULL DEFAULT 0,
    reps_given INTEGER NOT NULL DEFAULT 0,
    transfers_sent INTEGER NOT NULL DEFAULT 0,
    transfers_received INTEGER NOT NULL DEFAULT 0,
    transferred_out INTEGER NOT NULL DEFAULT 0,
    transferred_in INTEGER NOT NULL DEFAULT 0,
    biggest_win INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0,
    messages_count INTEGER NOT NULL DEFAULT 0,
    selected_banner TEXT NOT NULL DEFAULT 'default',
    last_tax_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cooldowns (
    user_id TEXT NOT NULL,
    comando TEXT NOT NULL,
    expira_em INTEGER NOT NULL,
    PRIMARY KEY (user_id, comando)
  );

  CREATE TABLE IF NOT EXISTS message_weekly_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    week_key TEXT NOT NULL,
    messages INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id, week_key)
  );

  CREATE TABLE IF NOT EXISTS voice_weekly_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    week_key TEXT NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id, week_key)
  );

  CREATE TABLE IF NOT EXISTS afk_status (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    guild_id TEXT,
    guild_name TEXT,
    target_id TEXT,
    note TEXT,
    created_at INTEGER NOT NULL
  );
`);

const userColumns = db.prepare("PRAGMA table_info(usuarios)").all().map(column => column.name);
if (!userColumns.includes("last_tax_at")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN last_tax_at INTEGER").run();
}
if (!userColumns.includes("xp")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN xp INTEGER NOT NULL DEFAULT 0").run();
}
if (!userColumns.includes("messages_count")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN messages_count INTEGER NOT NULL DEFAULT 0").run();
}
if (!userColumns.includes("selected_banner")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN selected_banner TEXT NOT NULL DEFAULT 'default'").run();
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function migrateLegacyCookies() {
  const marker = path.join(dataDir, ".sqlite-migrated");
  if (fs.existsSync(marker) || !fs.existsSync(legacyCookiesFile)) return;

  const count = db.prepare("SELECT COUNT(*) AS total FROM usuarios").get().total;
  if (count > 0) {
    fs.writeFileSync(marker, String(Date.now()));
    return;
  }

  try {
    const store = JSON.parse(fs.readFileSync(legacyCookiesFile, "utf8"));
    const users = store?.users && typeof store.users === "object" ? store.users : {};
    const insert = db.prepare(`
      INSERT OR IGNORE INTO usuarios (
        id, username, cookies, reputacao, bet_wins, bet_losses, draws,
        cookies_won, cookies_lost, games_played, total_earned, total_spent,
        daily_claims, daily_streak, best_daily_streak, work_count, rob_count,
        rob_wins, rob_losses, bonus_claims, rifa_wins, rifa_losses, reps_given,
        transfers_sent, transfers_received, transferred_out, transferred_in,
        biggest_win, created_at, updated_at
      ) VALUES (
        @id, @username, @cookies, @reputacao, @bet_wins, @bet_losses, @draws,
        @cookies_won, @cookies_lost, @games_played, @total_earned, @total_spent,
        @daily_claims, @daily_streak, @best_daily_streak, @work_count, @rob_count,
        @rob_wins, @rob_losses, @bonus_claims, @rifa_wins, @rifa_losses, @reps_given,
        @transfers_sent, @transfers_received, @transferred_out, @transferred_in,
        @biggest_win, @created_at, @updated_at
      )
    `);

    const insertCooldown = db.prepare(`
      INSERT OR REPLACE INTO cooldowns (user_id, comando, expira_em)
      VALUES (?, ?, ?)
    `);

    const now = Date.now();
    const migrate = db.transaction(() => {
      for (const [id, profile] of Object.entries(users)) {
        insert.run({
          id: String(id),
          username: profile.username || "Usuario",
          cookies: integer(profile.balance, 100),
          reputacao: integer(profile.repsReceived),
          bet_wins: integer(profile.betWins),
          bet_losses: integer(profile.betLosses),
          draws: integer(profile.draws),
          cookies_won: integer(profile.cookiesWon),
          cookies_lost: integer(profile.cookiesLost),
          games_played: integer(profile.gamesPlayed),
          total_earned: integer(profile.totalEarned, integer(profile.cookiesWon)),
          total_spent: integer(profile.totalSpent, integer(profile.cookiesLost)),
          daily_claims: integer(profile.dailyClaims),
          daily_streak: integer(profile.dailyStreak),
          best_daily_streak: integer(profile.bestDailyStreak, integer(profile.dailyStreak)),
          work_count: integer(profile.workCount),
          rob_count: integer(profile.robCount),
          rob_wins: integer(profile.robWins),
          rob_losses: integer(profile.robLosses),
          bonus_claims: integer(profile.bonusClaims),
          rifa_wins: integer(profile.rifaWins),
          rifa_losses: integer(profile.rifaLosses),
          reps_given: integer(profile.repsGiven),
          transfers_sent: integer(profile.transfersSent),
          transfers_received: integer(profile.transfersReceived),
          transferred_out: integer(profile.transferredOut),
          transferred_in: integer(profile.transferredIn),
          biggest_win: integer(profile.biggestWin),
          created_at: integer(profile.createdAt, now),
          updated_at: now,
        });

        const cooldowns = [
          ["daily", integer(profile.lastDailyAt) + 24 * 60 * 60 * 1000],
          ["trabalhar", integer(profile.lastWorkAt) + 8 * 60 * 60 * 1000],
          ["roubar", integer(profile.lastRobAt) + 6 * 60 * 60 * 1000],
          ["bonus", integer(profile.lastBonusAt) + 7 * 24 * 60 * 60 * 1000],
          ["rep", integer(profile.lastRepAt) + 24 * 60 * 60 * 1000],
        ];

        for (const [command, expiresAt] of cooldowns) {
          if (expiresAt > now) insertCooldown.run(String(id), command, expiresAt);
        }
      }
    });

    migrate();
    fs.writeFileSync(marker, String(Date.now()));
  } catch {
    fs.writeFileSync(marker, String(Date.now()));
  }
}

migrateLegacyCookies();

module.exports = db;
