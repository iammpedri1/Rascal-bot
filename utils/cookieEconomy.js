const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "../data");
const dataFile = path.join(dataDir, "cookies.json");

const START_BALANCE = 100;
const DAILY_MIN_REWARD = 1000;
const DAILY_MAX_REWARD = 5000;
const DAILY_COOLDOWN = 12 * 60 * 60 * 1000;
const DAILY_STREAK_WINDOW = 48 * 60 * 60 * 1000;
const WORK_MIN_REWARD = 1000;
const WORK_MAX_REWARD = 4000;
const WORK_COOLDOWN = 3 * 60 * 60 * 1000;
const MAX_TRANSACTIONS = 150;

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(createStore(), null, 2));
  }
}

function createStore() {
  return {
    version: 2,
    users: {},
    transactions: [],
  };
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(value, fallback = 0) {
  return Math.floor(number(value, fallback));
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

function normalizeUser(profile, user) {
  const now = Date.now();

  profile.id = String(profile.id || user?.id);
  profile.username = getUsername(user, profile.username);
  profile.balance = integer(profile.balance, START_BALANCE);
  profile.betWins = integer(profile.betWins);
  profile.betLosses = integer(profile.betLosses);
  profile.draws = integer(profile.draws);
  profile.cookiesWon = integer(profile.cookiesWon);
  profile.cookiesLost = integer(profile.cookiesLost);
  profile.gamesPlayed = integer(profile.gamesPlayed);
  profile.totalEarned = integer(profile.totalEarned, profile.cookiesWon);
  profile.totalSpent = integer(profile.totalSpent, profile.cookiesLost);
  profile.dailyClaims = integer(profile.dailyClaims);
  profile.dailyStreak = integer(profile.dailyStreak);
  profile.bestDailyStreak = integer(profile.bestDailyStreak, profile.dailyStreak);
  profile.lastDailyAt = integer(profile.lastDailyAt);
  profile.workCount = integer(profile.workCount);
  profile.lastWorkAt = integer(profile.lastWorkAt);
  profile.transfersSent = integer(profile.transfersSent);
  profile.transfersReceived = integer(profile.transfersReceived);
  profile.transferredOut = integer(profile.transferredOut);
  profile.transferredIn = integer(profile.transferredIn);
  profile.biggestWin = integer(profile.biggestWin);
  profile.createdAt = integer(profile.createdAt, now);
  profile.updatedAt = now;

  if (profile.balance < 0) profile.balance = 0;
  return profile;
}

function normalizeStore(store) {
  const normalized = store && typeof store === "object" ? store : createStore();

  normalized.version = 2;
  normalized.users = normalized.users && typeof normalized.users === "object"
    ? normalized.users
    : {};
  normalized.transactions = Array.isArray(normalized.transactions)
    ? normalized.transactions.slice(-MAX_TRANSACTIONS)
    : [];

  for (const [id, profile] of Object.entries(normalized.users)) {
    normalized.users[id] = normalizeUser({ ...profile, id });
  }

  return normalized;
}

function readStore() {
  ensureStore();

  try {
    return normalizeStore(JSON.parse(fs.readFileSync(dataFile, "utf8")));
  } catch {
    return createStore();
  }
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(normalizeStore(store), null, 2));
}

function getUser(store, user) {
  const id = String(user.id);

  if (!store.users[id]) {
    store.users[id] = {
      id,
      username: getUsername(user),
      balance: START_BALANCE,
    };
  }

  return normalizeUser(store.users[id], user);
}

function pushTransaction(store, type, userId, amount, details = {}) {
  store.transactions.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    userId: String(userId),
    amount: integer(amount),
    createdAt: Date.now(),
    guildId: details.guildId || null,
    guildName: details.guildName || null,
    targetId: details.targetId || null,
    note: details.note || null,
  });

  store.transactions = store.transactions.slice(-MAX_TRANSACTIONS);
}

function addBalance(profile, amount) {
  profile.balance += integer(amount);
  profile.updatedAt = Date.now();
  if (profile.balance < 0) profile.balance = 0;
}

function getProfile(user) {
  const store = readStore();
  const profile = getUser(store, user);

  writeStore(store);
  return profile;
}

function getNetProfit(profile) {
  return integer(profile.cookiesWon) - integer(profile.cookiesLost);
}

function canBet(user, amount) {
  const bet = cleanAmount(amount);
  const profile = getProfile(user);

  return profile.balance >= bet;
}

function claimDaily(user, details = {}) {
  const store = readStore();
  const profile = getUser(store, user);
  const now = Date.now();
  const nextAt = profile.lastDailyAt + DAILY_COOLDOWN;

  if (profile.lastDailyAt && now < nextAt) {
    writeStore(store);
    return {
      claimed: false,
      profile,
      remaining: nextAt - now,
      nextAt,
    };
  }

  const streak = profile.lastDailyAt && now - profile.lastDailyAt <= DAILY_STREAK_WINDOW
    ? profile.dailyStreak + 1
    : 1;
  const multiplier = number(details.rewardMultiplier, 1);
  const bonus = 0;
  const reward = Math.floor(randomAmount(DAILY_MIN_REWARD, DAILY_MAX_REWARD) * multiplier);

  addBalance(profile, reward);
  profile.dailyClaims += 1;
  profile.dailyStreak = streak;
  profile.bestDailyStreak = Math.max(profile.bestDailyStreak, streak);
  profile.lastDailyAt = now;
  profile.totalEarned += reward;

  pushTransaction(store, "daily", profile.id, reward, details);
  writeStore(store);

  return {
    claimed: true,
    profile,
    reward,
    bonus,
    streak,
    multiplier,
    nextAt: now + DAILY_COOLDOWN,
  };
}

function work(user, details = {}) {
  const store = readStore();
  const profile = getUser(store, user);
  const now = Date.now();
  const nextAt = profile.lastWorkAt + WORK_COOLDOWN;

  if (profile.lastWorkAt && now < nextAt) {
    writeStore(store);
    return {
      worked: false,
      profile,
      remaining: nextAt - now,
      nextAt,
    };
  }

  const multiplier = number(details.rewardMultiplier, 1);
  const reward = Math.floor(randomAmount(WORK_MIN_REWARD, WORK_MAX_REWARD) * multiplier);

  addBalance(profile, reward);
  profile.workCount += 1;
  profile.lastWorkAt = now;
  profile.totalEarned += reward;

  pushTransaction(store, "work", profile.id, reward, details);
  writeStore(store);

  return {
    worked: true,
    profile,
    reward,
    multiplier,
    nextAt: now + WORK_COOLDOWN,
  };
}

function transfer(fromUser, toUser, amount, details = {}) {
  const value = cleanAmount(amount);
  const store = readStore();
  const from = getUser(store, fromUser);
  const to = getUser(store, toUser);

  if (from.id === to.id) {
    writeStore(store);
    return {
      ok: false,
      reason: "self",
      from,
      to,
    };
  }

  if (from.balance < value) {
    writeStore(store);
    return {
      ok: false,
      reason: "balance",
      from,
      to,
    };
  }

  addBalance(from, -value);
  addBalance(to, value);

  from.transfersSent += 1;
  from.transferredOut += value;
  from.totalSpent += value;

  to.transfersReceived += 1;
  to.transferredIn += value;
  to.totalEarned += value;

  pushTransaction(store, "transfer_out", from.id, -value, {
    ...details,
    targetId: to.id,
  });
  pushTransaction(store, "transfer_in", to.id, value, {
    ...details,
    targetId: from.id,
  });

  writeStore(store);

  return {
    ok: true,
    from,
    to,
    amount: value,
  };
}

function settleBet(user, amount, result, details = {}) {
  const value = cleanAmount(amount);
  const store = readStore();
  const profile = getUser(store, user);

  profile.gamesPlayed += 1;

  if (result === "win") {
    addBalance(profile, value);
    profile.betWins += 1;
    profile.cookiesWon += value;
    profile.totalEarned += value;
    profile.biggestWin = Math.max(profile.biggestWin, value);
    pushTransaction(store, "bet_win", profile.id, value, details);
  }

  if (result === "lose") {
    addBalance(profile, -value);
    profile.betLosses += 1;
    profile.cookiesLost += value;
    profile.totalSpent += value;
    pushTransaction(store, "bet_loss", profile.id, -value, details);
  }

  writeStore(store);
  return profile;
}

function settleDuel(winnerUser, loserUser, amount, details = {}) {
  const value = cleanAmount(amount);
  const store = readStore();
  const winner = getUser(store, winnerUser);
  const loser = getUser(store, loserUser);

  winner.gamesPlayed += 1;
  loser.gamesPlayed += 1;

  addBalance(winner, value);
  winner.betWins += 1;
  winner.cookiesWon += value;
  winner.totalEarned += value;
  winner.biggestWin = Math.max(winner.biggestWin, value);

  addBalance(loser, -value);
  loser.betLosses += 1;
  loser.cookiesLost += value;
  loser.totalSpent += value;

  pushTransaction(store, "duel_win", winner.id, value, {
    ...details,
    targetId: loser.id,
  });
  pushTransaction(store, "duel_loss", loser.id, -value, {
    ...details,
    targetId: winner.id,
  });

  writeStore(store);

  return { winner, loser };
}

function settleDraw(userA, userB, details = {}) {
  const store = readStore();
  const profileA = getUser(store, userA);
  const profileB = getUser(store, userB);

  profileA.gamesPlayed += 1;
  profileB.gamesPlayed += 1;
  profileA.draws += 1;
  profileB.draws += 1;

  pushTransaction(store, "duel_draw", profileA.id, 0, {
    ...details,
    targetId: profileB.id,
  });
  pushTransaction(store, "duel_draw", profileB.id, 0, {
    ...details,
    targetId: profileA.id,
  });

  writeStore(store);

  return { profileA, profileB };
}

function getRank(limit = 10, type = "balance") {
  const store = readStore();
  const profiles = Object.values(store.users);

  const sorters = {
    balance: (a, b) => b.balance - a.balance,
    earned: (a, b) => b.totalEarned - a.totalEarned,
    wins: (a, b) => b.betWins - a.betWins,
    played: (a, b) => b.gamesPlayed - a.gamesPlayed,
    profit: (a, b) => getNetProfit(b) - getNetProfit(a),
  };

  return profiles
    .sort(sorters[type] || sorters.balance)
    .slice(0, limit);
}

function getHistory(user, limit = 8) {
  const store = readStore();
  const userId = String(user.id);

  return store.transactions
    .filter(transaction => transaction.userId === userId)
    .slice(-limit)
    .reverse();
}

module.exports = {
  START_BALANCE,
  DAILY_COOLDOWN,
  DAILY_MAX_REWARD,
  DAILY_MIN_REWARD,
  WORK_MAX_REWARD,
  WORK_MIN_REWARD,
  WORK_COOLDOWN,
  canBet,
  claimDaily,
  getHistory,
  getNetProfit,
  getProfile,
  getRank,
  settleBet,
  settleDraw,
  settleDuel,
  transfer,
  work,
};
