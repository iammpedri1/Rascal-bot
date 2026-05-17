const db = require("./db");
const cooldowns = require("./cooldowns");
const { addUserXp } = require("./xpSystem");

// ─── Constantes ───────────────────────────────────────────────────────────────

const START_BALANCE           = 100;

// Daily — base + bônus por streak
const DAILY_MIN_REWARD        = 900;
const DAILY_MAX_REWARD        = 1800;
const DAILY_STREAK_WINDOW     = 48 * 60 * 60 * 1000;
const DAILY_STREAK_BONUS      = 50;   // +50 cookies por dia de streak
const DAILY_STREAK_BONUS_CAP  = 1500; // bônus máximo de streak

// Work
const WORK_MIN_REWARD         = 250;
const WORK_MAX_REWARD         = 950;
const WORK_MIN_LOSS           = 150;
const WORK_MAX_LOSS           = 700;

// Roubo — balanceado
const ROB_MIN_TARGET_BALANCE  = 50;   // era 20 — evita roubar quem não tem nada
const ROB_SUCCESS_CHANCE      = 0.45; // era 0.5 — levemente mais difícil
const ROB_STEAL_MIN_PCT       = 8;    // era 5%
const ROB_STEAL_MAX_PCT       = 20;   // era 15%
const ROB_PENALTY_MIN         = 100;  // era 200 — penalidade mínima menor
const ROB_PENALTY_MAX         = 500;  // era 800 — penalidade máxima menor
const ROB_PENALTY_SCALE       = true; // penalidade proporcional ao saldo do ladrão

// Cooldowns
const DAILY_COOLDOWN          = cooldowns.DURATIONS.daily;
const WORK_COOLDOWN           = cooldowns.DURATIONS.trabalhar;
const ROB_COOLDOWN            = cooldowns.DURATIONS.roubar;
const BONUS_COOLDOWN          = cooldowns.DURATIONS.bonus;
const REP_COOLDOWN            = cooldowns.DURATIONS.rep;

// Impostos
const DAILY_TAX_RATE          = 0.01;
const DAILY_TAX_MAX           = 250;
const DAILY_TAX_GRACE_BALANCE = 500;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function cleanAmount(amount) {
  return Math.max(1, integer(amount, 0));
}

function randomAmount(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function getUsername(user, fallback = "Usuario") {
  return user?.username || user?.globalName || user?.displayName || fallback;
}

function rowToProfile(row) {
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    balance: integer(row.cookies, START_BALANCE),
    reputacao: integer(row.reputacao),
    betWins: integer(row.bet_wins),
    betLosses: integer(row.bet_losses),
    draws: integer(row.draws),
    cookiesWon: integer(row.cookies_won),
    cookiesLost: integer(row.cookies_lost),
    gamesPlayed: integer(row.games_played),
    totalEarned: integer(row.total_earned),
    totalSpent: integer(row.total_spent),
    dailyClaims: integer(row.daily_claims),
    dailyStreak: integer(row.daily_streak),
    bestDailyStreak: integer(row.best_daily_streak),
    workCount: integer(row.work_count),
    robCount: integer(row.rob_count),
    robWins: integer(row.rob_wins),
    robLosses: integer(row.rob_losses),
    bonusClaims: integer(row.bonus_claims),
    rifaWins: integer(row.rifa_wins),
    rifaLosses: integer(row.rifa_losses),
    repsGiven: integer(row.reps_given),
    repsReceived: integer(row.reputacao),
    transfersSent: integer(row.transfers_sent),
    transfersReceived: integer(row.transfers_received),
    transferredOut: integer(row.transferred_out),
    transferredIn: integer(row.transferred_in),
    biggestWin: integer(row.biggest_win),
    xp: integer(row.xp),
    messagesCount: integer(row.messages_count),
    selectedBanner: row.selected_banner || "default",
    lastTaxAt: integer(row.last_tax_at),
    createdAt: integer(row.created_at),
    updatedAt: integer(row.updated_at),
  };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function addBalance(userId, amount) {
  db.prepare(`
    UPDATE usuarios
    SET cookies = MAX(0, cookies + ?), updated_at = ?
    WHERE id = ?
  `).run(integer(amount), Date.now(), String(userId));
}

function updateStats(userId, changes) {
  const entries = Object.entries(changes).filter(([, value]) => integer(value) !== 0);
  if (!entries.length) return;

  const sets   = entries.map(([col]) => `${col} = ${col} + ?`).join(", ");
  const values = entries.map(([, v]) => integer(v));

  db.prepare(`UPDATE usuarios SET ${sets}, updated_at = ? WHERE id = ?`)
    .run(...values, Date.now(), String(userId));
}

function setStat(userId, column, value) {
  db.prepare(`UPDATE usuarios SET ${column} = ?, updated_at = ? WHERE id = ?`)
    .run(integer(value), Date.now(), String(userId));
}

function getById(userId) {
  return rowToProfile(db.prepare("SELECT * FROM usuarios WHERE id = ?").get(String(userId)));
}

function pushTransaction(type, userId, amount, details = {}) {
  db.prepare(`
    INSERT INTO transacoes (tipo, user_id, amount, guild_id, guild_name, target_id, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    type,
    String(userId),
    integer(amount),
    details.guildId  || null,
    details.guildName || null,
    details.targetId || null,
    details.note     || null,
    Date.now()
  );
}

// ─── Impostos ─────────────────────────────────────────────────────────────────

function applyDailyTax(userId) {
  const profile = rowToProfile(db.prepare("SELECT * FROM usuarios WHERE id = ?").get(String(userId)));
  const now = Date.now();
  if (!profile) return null;

  if (!profile.lastTaxAt) {
    db.prepare("UPDATE usuarios SET last_tax_at = ? WHERE id = ?").run(now, String(userId));
    return { profile, charged: 0, days: 0 };
  }

  const days = Math.floor((now - profile.lastTaxAt) / (24 * 60 * 60 * 1000));
  if (days <= 0) return { profile, charged: 0, days: 0 };

  if (profile.balance <= DAILY_TAX_GRACE_BALANCE) {
    db.prepare("UPDATE usuarios SET last_tax_at = ? WHERE id = ?").run(now, String(userId));
    return { profile, charged: 0, days: 0 };
  }

  const taxableBalance = profile.balance - DAILY_TAX_GRACE_BALANCE;
  const dailyTax = Math.min(DAILY_TAX_MAX, Math.max(1, Math.floor(taxableBalance * DAILY_TAX_RATE)));
  const charged  = Math.min(profile.balance - DAILY_TAX_GRACE_BALANCE, dailyTax * days);

  if (charged <= 0) return { profile, charged: 0, days: 0 };

  addBalance(profile.id, -charged);
  updateStats(profile.id, { total_spent: charged, cookies_lost: charged });
  pushTransaction("daily_tax", profile.id, -charged, { note: `${days} dia(s)` });
  db.prepare("UPDATE usuarios SET last_tax_at = ? WHERE id = ?").run(now, String(userId));

  return { profile: getById(profile.id), charged, days };
}

// ─── Usuário ──────────────────────────────────────────────────────────────────

function getUser(user) {
  const id  = String(user.id);
  const now = Date.now();

  db.prepare(`
    INSERT INTO usuarios (id, username, cookies, last_tax_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username   = excluded.username,
      updated_at = excluded.updated_at
  `).run(id, getUsername(user), START_BALANCE, now, now, now);

  applyDailyTax(id);

  return rowToProfile(db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id));
}

function getProfile(user) {
  return getUser(user);
}

// ─── Daily com multiplicador de streak ───────────────────────────────────────

function claimDaily(user, details = {}) {
  const profile  = getUser(user);
  const cooldown = cooldowns.check(profile.id, "daily");

  if (!cooldown.ready) {
    return {
      claimed: false,
      profile,
      remaining: cooldown.remaining,
      nextAt: cooldown.expiresAt,
    };
  }

  const now = Date.now();
  const previousDaily = db.prepare(`
    SELECT created_at AS createdAt
    FROM transacoes
    WHERE user_id = ? AND tipo = 'daily'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(profile.id);

  const streak = previousDaily && now - previousDaily.createdAt <= DAILY_STREAK_WINDOW
    ? profile.dailyStreak + 1
    : 1;

  // Bônus de streak: +50 por dia, máximo de DAILY_STREAK_BONUS_CAP
  const streakBonus = Math.min(
    DAILY_STREAK_BONUS_CAP,
    (streak - 1) * DAILY_STREAK_BONUS
  );

  const base   = randomAmount(DAILY_MIN_REWARD, DAILY_MAX_REWARD);
  const reward = base + streakBonus;
  const nextAt = cooldowns.consume(profile.id, "daily");

  addBalance(profile.id, reward);
  updateStats(profile.id, {
    cookies_won:  reward,
    total_earned: reward,
    daily_claims: 1,
  });
  setStat(profile.id, "daily_streak", streak);
  if (streak > profile.bestDailyStreak) setStat(profile.id, "best_daily_streak", streak);
  pushTransaction("daily", profile.id, reward, details);

  const xpReward = addUserXp(user, 120);

  return {
    claimed: true,
    profile: getById(profile.id),
    reward,
    base,
    streakBonus,
    xpReward,
    streak,
    nextAt,
  };
}

// ─── Work ─────────────────────────────────────────────────────────────────────

function work(user, details = {}) {
  const profile  = getUser(user);
  const cooldown = cooldowns.check(profile.id, "trabalhar");

  if (!cooldown.ready) {
    return {
      worked: false,
      profile,
      remaining: cooldown.remaining,
      nextAt: cooldown.expiresAt,
    };
  }

  const nextAt  = cooldowns.consume(profile.id, "trabalhar");
  const success = Math.random() < 0.4;

  updateStats(profile.id, { work_count: 1 });

  if (!success) {
    const loss = randomAmount(WORK_MIN_LOSS, WORK_MAX_LOSS);

    addBalance(profile.id, -loss);
    updateStats(profile.id, { cookies_lost: loss, total_spent: loss });
    pushTransaction("work_loss", profile.id, -loss, details);

    const xpReward = addUserXp(user, 25);

    return {
      worked: true,
      success: false,
      profile: getById(profile.id),
      loss,
      xpReward,
      reason: details.reason || null,
      nextAt,
    };
  }

  const reward = randomAmount(WORK_MIN_REWARD, WORK_MAX_REWARD);

  addBalance(profile.id, reward);
  updateStats(profile.id, { cookies_won: reward, total_earned: reward });
  pushTransaction("work", profile.id, reward, details);

  const xpReward = addUserXp(user, 60);

  return {
    worked: true,
    success: true,
    profile: getById(profile.id),
    reward,
    xpReward,
    nextAt,
  };
}

// ─── Bonus ────────────────────────────────────────────────────────────────────

function claimBonus(user, details = {}) {
  const profile  = getUser(user);
  const cooldown = cooldowns.check(profile.id, "bonus");

  if (!cooldown.ready) {
    return {
      claimed: false,
      profile,
      remaining: cooldown.remaining,
      nextAt: cooldown.expiresAt,
    };
  }

  const reward = randomAmount(150, 450);
  const nextAt = cooldowns.consume(profile.id, "bonus");

  addBalance(profile.id, reward);
  updateStats(profile.id, {
    bonus_claims: 1,
    cookies_won:  reward,
    total_earned: reward,
  });
  pushTransaction("bonus", profile.id, reward, details);

  return {
    claimed: true,
    profile: getById(profile.id),
    reward,
    nextAt,
  };
}

// ─── Roubo balanceado ─────────────────────────────────────────────────────────

function rob(thiefUser, targetUser, details = {}) {
  const thief  = getUser(thiefUser);
  const target = getUser(targetUser);

  if (thief.id === target.id) {
    return { ok: false, reason: "self", thief, target };
  }

  if (target.balance < ROB_MIN_TARGET_BALANCE) {
    return { ok: false, reason: "target_balance", thief, target };
  }

  const cooldown = cooldowns.check(thief.id, "roubar");
  if (!cooldown.ready) {
    return {
      ok: false,
      reason: "cooldown",
      thief,
      target,
      remaining: cooldown.remaining,
      nextAt: cooldown.expiresAt,
    };
  }

  const nextAt  = cooldowns.consume(thief.id, "roubar");
  const success = Math.random() < ROB_SUCCESS_CHANCE;

  updateStats(thief.id, { rob_count: 1 });

  if (success) {
    const percent = randomAmount(ROB_STEAL_MIN_PCT, ROB_STEAL_MAX_PCT);
    const stolen  = Math.max(1, Math.floor(target.balance * (percent / 100)));

    addBalance(target.id, -stolen);
    addBalance(thief.id, stolen);
    updateStats(thief.id, { rob_wins: 1, cookies_won: stolen, total_earned: stolen });
    updateStats(target.id, { cookies_lost: stolen, total_spent: stolen });
    pushTransaction("rob_win", thief.id, stolen, { ...details, targetId: target.id, note: `${percent}%` });
    pushTransaction("rob_loss_target", target.id, -stolen, { ...details, targetId: thief.id, note: `${percent}%` });

    return {
      ok: true,
      success: true,
      thief: getById(thief.id),
      target: getById(target.id),
      stolen,
      percent,
      nextAt,
    };
  }

  // Penalidade proporcional ao saldo do ladrão — não perde mais do que tem
  let penalty = randomAmount(ROB_PENALTY_MIN, ROB_PENALTY_MAX);
  if (ROB_PENALTY_SCALE) {
    // Penalidade = até 10% do saldo do ladrão, limitada ao range configurado
    const scaledMax = Math.max(ROB_PENALTY_MIN, Math.floor(thief.balance * 0.10));
    penalty = Math.min(penalty, scaledMax, thief.balance);
  }
  penalty = Math.max(1, penalty);

  addBalance(thief.id, -penalty);
  updateStats(thief.id, { rob_losses: 1, cookies_lost: penalty, total_spent: penalty });
  pushTransaction("rob_fail", thief.id, -penalty, { ...details, targetId: target.id });

  return {
    ok: true,
    success: false,
    thief: getById(thief.id),
    target,
    penalty,
    nextAt,
  };
}

// ─── Rifa ─────────────────────────────────────────────────────────────────────

function playRifa(user, amount, details = {}) {
  const value   = cleanAmount(amount);
  const profile = getUser(user);

  if (profile.balance < value) {
    return { ok: false, reason: "balance", profile, amount: value };
  }

  if (Math.random() < 0.4) {
    const profit = value;
    const prize  = value * 2;

    addBalance(profile.id, profit);
    updateStats(profile.id, { rifa_wins: 1, cookies_won: profit, total_earned: profit });
    if (prize > profile.biggestWin) setStat(profile.id, "biggest_win", prize);
    pushTransaction("rifa_win", profile.id, profit, details);
    addUserXp(user, 70);

    return { ok: true, won: true, profile: getById(profile.id), amount: value, prize };
  }

  addBalance(profile.id, -value);
  updateStats(profile.id, { rifa_losses: 1, cookies_lost: value, total_spent: value });
  pushTransaction("rifa_loss", profile.id, -value, details);
  addUserXp(user, 25);

  return { ok: true, won: false, profile: getById(profile.id), amount: value };
}

// ─── Rep ──────────────────────────────────────────────────────────────────────

function giveRep(fromUser, toUser, details = {}) {
  const from = getUser(fromUser);
  const to   = getUser(toUser);

  if (from.id === to.id) return { ok: false, reason: "self", from, to };

  const cooldown = cooldowns.check(from.id, "rep");
  if (!cooldown.ready) {
    return { ok: false, reason: "cooldown", from, to, remaining: cooldown.remaining, nextAt: cooldown.expiresAt };
  }

  const nextAt = cooldowns.consume(from.id, "rep");

  updateStats(from.id, { reps_given: 1 });
  updateStats(to.id,   { reputacao: 1 });
  pushTransaction("rep", from.id, 0, { ...details, targetId: to.id });

  return { ok: true, from: getById(from.id), to: getById(to.id), nextAt };
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

function transfer(fromUser, toUser, amount, details = {}) {
  const value = cleanAmount(amount);
  const from  = getUser(fromUser);
  const to    = getUser(toUser);

  if (from.id === to.id) return { ok: false, reason: "self", from, to };
  if (from.balance < value) return { ok: false, reason: "balance", from, to };

  addBalance(from.id, -value);
  addBalance(to.id, value);
  updateStats(from.id, { transfers_sent: 1, transferred_out: value, total_spent: value });
  updateStats(to.id,   { transfers_received: 1, transferred_in: value, total_earned: value });
  pushTransaction("transfer_out", from.id, -value, { ...details, targetId: to.id });
  pushTransaction("transfer_in",  to.id,   value,  { ...details, targetId: from.id });

  return { ok: true, from: getById(from.id), to: getById(to.id), amount: value };
}

// ─── Apostas ──────────────────────────────────────────────────────────────────

function canBet(user, amount) {
  return getProfile(user).balance >= cleanAmount(amount);
}

function settleBet(user, amount, result, details = {}) {
  const value   = cleanAmount(amount);
  const profile = getUser(user);

  updateStats(profile.id, { games_played: 1 });

  if (result === "win") {
    addBalance(profile.id, value);
    updateStats(profile.id, { bet_wins: 1, cookies_won: value, total_earned: value });
    if (value > profile.biggestWin) setStat(profile.id, "biggest_win", value);
    pushTransaction("bet_win", profile.id, value, details);
  }

  if (result === "lose") {
    addBalance(profile.id, -value);
    updateStats(profile.id, { bet_losses: 1, cookies_lost: value, total_spent: value });
    pushTransaction("bet_loss", profile.id, -value, details);
  }

  return getById(profile.id);
}

function settleDuel(winnerUser, loserUser, amount, details = {}) {
  const value  = cleanAmount(amount);
  const winner = getUser(winnerUser);
  const loser  = getUser(loserUser);

  addBalance(winner.id, value);
  addBalance(loser.id, -value);
  updateStats(winner.id, { games_played: 1, bet_wins: 1, cookies_won: value, total_earned: value });
  updateStats(loser.id,  { games_played: 1, bet_losses: 1, cookies_lost: value, total_spent: value });
  if (value > winner.biggestWin) setStat(winner.id, "biggest_win", value);
  pushTransaction("duel_win",  winner.id, value,  { ...details, targetId: loser.id });
  pushTransaction("duel_loss", loser.id, -value,  { ...details, targetId: winner.id });
  addUserXp(winnerUser, 80);
  addUserXp(loserUser, 25);

  return { winner: getById(winner.id), loser: getById(loser.id) };
}

function settleDraw(userA, userB, details = {}) {
  const profileA = getUser(userA);
  const profileB = getUser(userB);

  updateStats(profileA.id, { games_played: 1, draws: 1 });
  updateStats(profileB.id, { games_played: 1, draws: 1 });
  pushTransaction("duel_draw", profileA.id, 0, { ...details, targetId: profileB.id });
  pushTransaction("duel_draw", profileB.id, 0, { ...details, targetId: profileA.id });

  return { profileA: getById(profileA.id), profileB: getById(profileB.id) };
}

// ─── Rank ─────────────────────────────────────────────────────────────────────

function getRank(limit = 10, type = "balance") {
  const orderBy = {
    balance: "cookies",
    earned:  "total_earned",
    wins:    "bet_wins",
    played:  "games_played",
    profit:  "(cookies_won - cookies_lost)",
  }[type] || "cookies";

  return db.prepare(`SELECT * FROM usuarios ORDER BY ${orderBy} DESC LIMIT ?`)
    .all(integer(limit, 10))
    .map(rowToProfile);
}

function getHistory(user, limit = 8) {
  return db.prepare(`
    SELECT
      tipo          AS type,
      user_id       AS userId,
      amount,
      guild_id      AS guildId,
      guild_name    AS guildName,
      target_id     AS targetId,
      note,
      created_at    AS createdAt
    FROM transacoes
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(String(user.id), integer(limit, 8));
}

function getNetProfit(profile) {
  return integer(profile.cookiesWon) - integer(profile.cookiesLost);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  BONUS_COOLDOWN,
  DAILY_COOLDOWN,
  DAILY_MAX_REWARD,
  DAILY_MIN_REWARD,
  DAILY_STREAK_BONUS,
  DAILY_STREAK_BONUS_CAP,
  REP_COOLDOWN,
  ROB_COOLDOWN,
  START_BALANCE,
  WORK_COOLDOWN,
  WORK_MAX_REWARD,
  WORK_MIN_REWARD,
  addBalance,
  updateStats,
  pushTransaction,
  canBet,
  claimBonus,
  claimDaily,
  giveRep,
  getById,
  getHistory,
  getNetProfit,
  getProfile,
  getRank,
  playRifa,
  rob,
  settleBet,
  settleDraw,
  settleDuel,
  transfer,
  work,
};
