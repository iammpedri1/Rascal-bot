const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const logger = require("./logger");

const dataDir = process.env.BOT_DATA_DIR
  ? path.resolve(process.env.BOT_DATA_DIR)
  : path.resolve(process.cwd(), "data");
const dbFile = path.join(dataDir, "database.sqlite");
const legacyCookiesFile = path.join(dataDir, "cookies.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbFile);
// Pragmas de desempenho/robustez para um processo 24/7 rodando em SQLite/WAL.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("secure_delete = ON");
// NORMAL e seguro com WAL e evita um fsync a cada escrita (mensagens, cooldowns...).
db.pragma("synchronous = NORMAL");
// Espera o lock em vez de falhar quando outra escrita estiver em andamento.
db.pragma("busy_timeout = 5000");
// Tabelas temporarias ficam em RAM, sem passar pelo disco.
db.pragma("temp_store = MEMORY");
// Limita o page cache a ~4MB para manter o consumo de RAM previsivel.
db.pragma("cache_size = -4000");
// Leitura via mmap reduz syscalls; as paginas ficam fora do heap do processo.
db.pragma("mmap_size = 67108864");
// Evita que o arquivo -wal cresca sem limite apos os checkpoints.
db.pragma("journal_size_limit = 8388608");

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
    cooldown_daily INTEGER NOT NULL DEFAULT 0,
    cooldown_trabalhar INTEGER NOT NULL DEFAULT 0,
    cooldown_roubar INTEGER NOT NULL DEFAULT 0,
    cooldown_bonus INTEGER NOT NULL DEFAULT 0,
    cooldown_rep INTEGER NOT NULL DEFAULT 0,
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
    voice_seconds_lifetime INTEGER NOT NULL DEFAULT 0,
    transmission_seconds_lifetime INTEGER NOT NULL DEFAULT 0,
    selected_banner TEXT NOT NULL DEFAULT 'default',
    vip INTEGER NOT NULL DEFAULT 0,
    cookie_boost_until INTEGER NOT NULL DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS transmission_weekly_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    week_key TEXT NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id, week_key)
  );

  CREATE TABLE IF NOT EXISTS voice_daily_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    day_key TEXT NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id, day_key)
  );

  CREATE TABLE IF NOT EXISTS rank_reward_claims (
    guild_id TEXT NOT NULL,
    week_key TEXT NOT NULL,
    rank_type TEXT NOT NULL,
    awarded_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, week_key, rank_type)
  );

  CREATE TABLE IF NOT EXISTS afk_status (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS birthdays (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    day INTEGER NOT NULL,
    month INTEGER NOT NULL,
    last_sent_year INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
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

  CREATE TABLE IF NOT EXISTS stats_jogos (
    user_id TEXT PRIMARY KEY,
    vitorias INTEGER NOT NULL DEFAULT 0,
    derrotas INTEGER NOT NULL DEFAULT 0,
    empates INTEGER NOT NULL DEFAULT 0,
    partidas INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_bet_holds (
    game_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    stake INTEGER NOT NULL CHECK (stake > 0),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (game_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS cookie_shop_inventory (
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    purchased_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS guild_shop_role_purchases (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    price INTEGER NOT NULL,
    benefit_percent INTEGER NOT NULL DEFAULT 0,
    purchased_at INTEGER NOT NULL,
    expires_at INTEGER,
    PRIMARY KEY (guild_id, user_id, role_id, kind)
  );

  CREATE TABLE IF NOT EXISTS shop_role_purchase_reservations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    guild_id TEXT NOT NULL,
    guild_name TEXT NOT NULL,
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('color', 'vip')),
    price INTEGER NOT NULL CHECK (price > 0),
    benefit_percent INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER,
    transaction_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cooldown_notifications (
    user_id TEXT NOT NULL,
    command TEXT NOT NULL,
    notify_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    notified_at INTEGER,
    PRIMARY KEY (user_id, command)
  );

  CREATE TABLE IF NOT EXISTS message_monthly_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    month_key TEXT NOT NULL,
    messages INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id, month_key)
  );

  CREATE TABLE IF NOT EXISTS voice_monthly_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    month_key TEXT NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id, month_key)
  );

  CREATE TABLE IF NOT EXISTS monthly_top_posts (
    guild_id TEXT NOT NULL,
    month_key TEXT NOT NULL,
    posted_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, month_key)
  );

  CREATE TABLE IF NOT EXISTS monthly_role_assignments (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    rank_type TEXT NOT NULL,
    assigned_at INTEGER NOT NULL,
    month_key TEXT NOT NULL,
    PRIMARY KEY (guild_id, rank_type, month_key)
  );

  CREATE TABLE IF NOT EXISTS monthly_tax_runs (
    month_key TEXT PRIMARY KEY,
    completed_at INTEGER NOT NULL,
    taxed_accounts INTEGER NOT NULL DEFAULT 0,
    exempt_accounts INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS monthly_tax_accounts (
    month_key TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    processed_at INTEGER NOT NULL,
    PRIMARY KEY (month_key, user_id)
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS voice_reward_state (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    eligible_since INTEGER,
    last_reward_at INTEGER,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS guild_memberships (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at INTEGER,
    left_at INTEGER,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    created_by TEXT NOT NULL,
    prize TEXT NOT NULL,
    winner_count INTEGER NOT NULL DEFAULT 1,
    ends_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    winner_ids TEXT NOT NULL DEFAULT '[]',
    announcement_sent INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS giveaway_participants (
    giveaway_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (giveaway_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS moderation_guild_settings (
    guild_id TEXT PRIMARY KEY,
    log_channel_id TEXT,
    gif_banir TEXT,
    gif_mute TEXT,
    gif_castigo TEXT,
    gif_aviso TEXT,
    updated_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS moderation_punishments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    guild_name TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_username TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    moderator_username TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    duration_ms INTEGER,
    issued_at INTEGER NOT NULL,
    expires_at INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    log_channel_id TEXT,
    log_message_id TEXT,
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS raid_join_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_bot INTEGER NOT NULL DEFAULT 0,
    joined_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS raid_lockdowns (
    guild_id TEXT PRIMARY KEY,
    enabled_at INTEGER NOT NULL,
    activated_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    verification_level INTEGER,
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS raid_lockdown_channel_state (
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    send_messages TEXT NOT NULL,
    create_instant_invite TEXT NOT NULL,
    PRIMARY KEY (guild_id, channel_id)
  );

  CREATE TABLE IF NOT EXISTS weekly_lottery_settings (
    guild_id TEXT PRIMARY KEY,
    announcement_channel_id TEXT,
    updated_by TEXT,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weekly_lottery_pools (
    guild_id TEXT NOT NULL,
    draw_key TEXT NOT NULL,
    draw_at INTEGER NOT NULL,
    pot_cookies INTEGER NOT NULL DEFAULT 0,
    ticket_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'drawn', 'empty')),
    created_at INTEGER NOT NULL,
    drawn_at INTEGER,
    PRIMARY KEY (guild_id, draw_key)
  );

  CREATE TABLE IF NOT EXISTS weekly_lottery_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    draw_key TEXT NOT NULL,
    user_id TEXT NOT NULL,
    purchased_at INTEGER NOT NULL,
    price INTEGER NOT NULL,
    FOREIGN KEY (guild_id, draw_key) REFERENCES weekly_lottery_pools(guild_id, draw_key)
  );

  CREATE TABLE IF NOT EXISTS weekly_lottery_draws (
    guild_id TEXT NOT NULL,
    draw_key TEXT NOT NULL,
    winner_user_id TEXT NOT NULL,
    winning_ticket_id INTEGER NOT NULL,
    pot_cookies INTEGER NOT NULL,
    ticket_count INTEGER NOT NULL,
    drawn_at INTEGER NOT NULL,
    announced_at INTEGER,
    announcement_error TEXT,
    PRIMARY KEY (guild_id, draw_key)
  );

  CREATE TABLE IF NOT EXISTS scratch_games (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    grid_json TEXT NOT NULL,
    picks_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'won', 'lost', 'refunded')),
    price INTEGER NOT NULL,
    prize INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    finished_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS black_market_inventory (
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, item_key)
  );

  CREATE TABLE IF NOT EXISTS black_market_prison (
    user_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    jailed_at INTEGER NOT NULL,
    release_at INTEGER NOT NULL,
    bail_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'jailed' CHECK (status IN ('jailed', 'bailed', 'released')),
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS server_boost_rewards (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    awarded_at INTEGER NOT NULL,
    bonus_cookies INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_usuarios_xp ON usuarios (xp DESC, messages_count DESC);
  CREATE INDEX IF NOT EXISTS idx_message_weekly_rank ON message_weekly_stats (guild_id, week_key, messages DESC);
  CREATE INDEX IF NOT EXISTS idx_voice_weekly_rank ON voice_weekly_stats (guild_id, week_key, seconds DESC);
  CREATE INDEX IF NOT EXISTS idx_voice_daily_user ON voice_daily_stats (guild_id, user_id, day_key);
  CREATE INDEX IF NOT EXISTS idx_birthdays_due ON birthdays (day, month, last_sent_year);
  CREATE INDEX IF NOT EXISTS idx_cooldowns_expira_em ON cooldowns (expira_em);
  CREATE INDEX IF NOT EXISTS idx_cooldown_notifications_due ON cooldown_notifications (status, notify_at);
  CREATE INDEX IF NOT EXISTS idx_guild_memberships_left ON guild_memberships (user_id, left_at);
  CREATE INDEX IF NOT EXISTS idx_giveaways_due ON giveaways (status, ends_at);
  CREATE INDEX IF NOT EXISTS idx_message_monthly_rank ON message_monthly_stats (guild_id, month_key, messages DESC);
  CREATE INDEX IF NOT EXISTS idx_voice_monthly_rank ON voice_monthly_stats (guild_id, month_key, seconds DESC);
  CREATE INDEX IF NOT EXISTS idx_transmission_weekly_rank ON transmission_weekly_stats (guild_id, week_key, seconds DESC);
  CREATE INDEX IF NOT EXISTS idx_monthly_tax_accounts_status ON monthly_tax_accounts (month_key, status);
  CREATE INDEX IF NOT EXISTS idx_moderation_target ON moderation_punishments (guild_id, target_id, issued_at DESC);
  CREATE INDEX IF NOT EXISTS idx_moderation_moderator ON moderation_punishments (guild_id, moderator_id, issued_at DESC);
  CREATE INDEX IF NOT EXISTS idx_raid_join_window ON raid_join_events (guild_id, joined_at DESC);
  CREATE INDEX IF NOT EXISTS idx_shop_role_reservations_created ON shop_role_purchase_reservations (created_at);
  CREATE INDEX IF NOT EXISTS idx_lottery_pools_due ON weekly_lottery_pools (status, draw_at);
  CREATE INDEX IF NOT EXISTS idx_lottery_tickets_draw ON weekly_lottery_tickets (guild_id, draw_key, id);
  CREATE INDEX IF NOT EXISTS idx_lottery_draws_pending_announcement ON weekly_lottery_draws (announced_at, drawn_at);
  CREATE INDEX IF NOT EXISTS idx_scratch_games_expiration ON scratch_games (status, expires_at);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_scratch_one_open_per_user
    ON scratch_games (guild_id, user_id) WHERE status IN ('pending', 'open');
  CREATE INDEX IF NOT EXISTS idx_black_market_prison_status ON black_market_prison (status, release_at);
`);

// Atualiza as estatisticas do planejador de consultas apos criar/alterar indices.
db.pragma("optimize");

const userColumns = db.prepare("PRAGMA table_info(usuarios)").all().map(column => column.name);
if (!userColumns.includes("last_tax_at")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN last_tax_at INTEGER").run();
}
if (!userColumns.includes("inactivity_tax_periods")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN inactivity_tax_periods INTEGER NOT NULL DEFAULT 0").run();
}
if (!userColumns.includes("xp")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN xp INTEGER NOT NULL DEFAULT 0").run();
}
if (!userColumns.includes("messages_count")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN messages_count INTEGER NOT NULL DEFAULT 0").run();
}
if (!userColumns.includes("voice_seconds_lifetime")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN voice_seconds_lifetime INTEGER NOT NULL DEFAULT 0").run();
}
if (!userColumns.includes("transmission_seconds_lifetime")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN transmission_seconds_lifetime INTEGER NOT NULL DEFAULT 0").run();
}
if (!userColumns.includes("selected_banner")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN selected_banner TEXT NOT NULL DEFAULT 'default'").run();
}
if (!userColumns.includes("vip")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN vip INTEGER NOT NULL DEFAULT 0").run();
}
if (!userColumns.includes("cookie_boost_until")) {
  db.prepare("ALTER TABLE usuarios ADD COLUMN cookie_boost_until INTEGER NOT NULL DEFAULT 0").run();
}
for (const column of [
  "cooldown_daily",
  "cooldown_trabalhar",
  "cooldown_roubar",
  "cooldown_bonus",
  "cooldown_rep",
]) {
  if (!userColumns.includes(column)) {
    db.prepare(`ALTER TABLE usuarios ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`).run();
  }
}

// Mantém as colunas legíveis no perfil atualizadas com os timestamps já salvos no schema legado.
for (const [command, column] of [
  ["daily", "cooldown_daily"],
  ["trabalhar", "cooldown_trabalhar"],
  ["roubar", "cooldown_roubar"],
  ["bonus", "cooldown_bonus"],
  ["rep", "cooldown_rep"],
]) {
  db.prepare(`
    UPDATE usuarios
    SET ${column} = COALESCE((
      SELECT expira_em FROM cooldowns
      WHERE cooldowns.user_id = usuarios.id AND cooldowns.comando = ?
    ), ${column})
  `).run(command);
}

const shopColumns = db.prepare("PRAGMA table_info(cookie_shop_inventory)").all().map(column => column.name);
if (!shopColumns.includes("quantity")) {
  db.prepare("ALTER TABLE cookie_shop_inventory ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1").run();
}

for (const table of ["guild_shop_role_purchases", "shop_role_purchase_reservations"]) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
  if (!columns.includes("benefit_percent")) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN benefit_percent INTEGER NOT NULL DEFAULT 0`).run();
  }
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

interface LegacyProfile {
  [key: string]: string | number | undefined;
  username?: string;
  balance?: number;
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
    const users = store?.users && typeof store.users === "object"
      ? store.users as Record<string, LegacyProfile>
      : {};
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
          ["trabalhar", integer(profile.lastWorkAt) + 3 * 60 * 60 * 1000],
          ["roubar", integer(profile.lastRobAt) + 6 * 60 * 60 * 1000],
          ["bonus", integer(profile.lastBonusAt) + 7 * 24 * 60 * 60 * 1000],
          ["rep", integer(profile.lastRepAt) + 24 * 60 * 60 * 1000],
        ];

        for (const [command, expiresAt] of cooldowns) {
          const expires = integer(expiresAt);
          if (expires > now) insertCooldown.run(String(id), command, expires);
        }
      }
    });

    migrate();
    fs.writeFileSync(marker, String(Date.now()));
  } catch (error) {
    logger.error("Falha ao migrar cookies legados para SQLite", error, {
      legacyCookiesFile,
    });
  }
}

migrateLegacyCookies();

module.exports = db;
