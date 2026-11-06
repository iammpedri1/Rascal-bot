const db = require("./db");
const cooldowns = require("./cooldowns");
const { PRIMARY_GUILD_ID } = require("./primaryGuild");
const blackMarket = require("./blackMarket") as typeof import("./blackMarket");
const { COLOR_ITEMS, COOLDOWN_TARGETS, SHOP_ITEMS_BY_ID } = require("./cookieShop");
const { resolveNativeWorkRoll } = require("./nativeWork") as typeof import("./nativeWork");
const { getEconomyConfig } = require("./economyConfig") as typeof import("./economyConfig");
const MAX_COOKIE_AMOUNT = 2_147_483_647;

interface TransactionDetails {
  guildId?: string | null;
  guildName?: string | null;
  targetId?: string | null;
  reason?: string | null;
  note?: string | null;
  job?: string | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const START_BALANCE = 100;

const WORK_PROFESSIONS = [
  ["Jardineiro(a)", "🌳", 800, 1500],
  ["Programador(a)", "💻", 1500, 3000],
  ["Cozinheiro(a)", "👨‍🍳", 700, 1200],
  ["Astronauta", "👨‍🚀", 5000, 10000],
  ["Advogado(a)", "⚖️", 2000, 4500],
  ["Médico(a)", "🩺", 2500, 5000],
  ["Streamer", "🎮", 100, 8000],
  ["Padeiro(a)", "🥖", 600, 1100],
  ["Motorista de app", "🚗", 800, 1600],
  ["Professor(a)", "📚", 1000, 2500],
  ["Policial", "👮", 1200, 3000],
  ["Youtuber", "🎥", 50, 9000],
  ["Minerador(a)", "⛏️", 900, 2200],
  ["Lixeiro(a)", "🗑️", 500, 1000],
  ["Encanador(a)", "🔧", 700, 1400],
  ["Cientista", "🔬", 3000, 7000],
  ["Piloto de avião", "✈️", 4000, 8000],
  ["Chef de cozinha", "🍳", 2000, 4000],
  ["Personal trainer", "💪", 1200, 2500],
  ["Fotógrafo(a)", "📸", 900, 2000],
  ["Designer gráfico", "🎨", 1100, 2400],
  ["Músico", "🎸", 300, 5000],
  ["Ator / Atriz", "🎭", 500, 7000],
  ["Veterinário(a)", "🐶", 1800, 3500],
  ["Arquiteto(a)", "📐", 2200, 4800],
  ["Carteiro(a)", "📬", 600, 1200],
  ["Bombeiro(a)", "🚒", 1500, 2800],
  ["Dentista", "🦷", 2000, 4200],
  ["Jornalista", "📰", 1100, 2600],
  ["Zelador(a)", "🧹", 500, 1000],
] as const;

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
    messagesCount: integer(row.messages_count),
    selectedBanner: row.selected_banner || "default",
    isVip: integer(row.vip) === 1,
    cookieBoostUntil: integer(row.cookie_boost_until),
    lastTaxAt: integer(row.last_tax_at),
    inactivityTaxPeriods: integer(row.inactivity_tax_periods),
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

  const sets = entries.map(([col]) => `${col} = ${col} + ?`).join(", ");
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

function applyCookieBonuses(userId, baseReward) {
  const perks = db.prepare("SELECT vip, cookie_boost_until FROM usuarios WHERE id = ?")
    .get(String(userId));
  const now = Date.now();
  const vipPurchase = db.prepare(`
    SELECT MAX(
      CASE
        WHEN benefit_percent > 0 THEN benefit_percent
        WHEN price >= 60000 THEN 15
        WHEN price >= 30000 THEN 10
        ELSE 5
      END
    ) AS bonusPercent
    FROM guild_shop_role_purchases
    WHERE guild_id = ? AND user_id = ? AND kind = 'vip'
      AND (expires_at IS NULL OR expires_at > ?)
  `).get(String(PRIMARY_GUILD_ID), String(userId), now);
  const purchasedVipPercent = integer(vipPurchase?.bonusPercent);
  const vipPercent = purchasedVipPercent > 0 ? purchasedVipPercent : (perks?.vip ? 10 : 0);
  const bonusPercent = vipPercent + (integer(perks?.cookie_boost_until) > now ? 50 : 0);
  return Math.floor(integer(baseReward) * (100 + bonusPercent) / 100);
}

function applyPermanentDailyBoost(userId, guildId, reward) {
  const boosted = Boolean(db.prepare(`
    SELECT 1 FROM server_boost_rewards WHERE guild_id = ? AND user_id = ?
  `).get(String(guildId || PRIMARY_GUILD_ID), String(userId)));
  return { reward: boosted ? integer(reward) * 2 : integer(reward), multiplier: boosted ? 2 : 1 };
}

function pushTransaction(type, userId, amount, details: TransactionDetails = {}) {
  db.prepare(`
    INSERT INTO transacoes (tipo, user_id, amount, guild_id, guild_name, target_id, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    type,
    String(userId),
    integer(amount),
    details.guildId || null,
    details.guildName || null,
    details.targetId || null,
    details.note || null,
    Date.now()
  );
}

// ─── Impostos ─────────────────────────────────────────────────────────────────

function applyDailyTax(userId) {
  const config = getEconomyConfig();
  const row = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(String(userId));
  const profile = rowToProfile(row);
  const now = Date.now();
  if (!profile) return null;

  const lastDaily = db.prepare(`
    SELECT created_at AS createdAt
    FROM transacoes
    WHERE user_id = ? AND tipo = 'daily'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(profile.id);
  const inactivityStart = integer(lastDaily?.createdAt, profile.createdAt || now);
  const duePeriods = Math.floor(Math.max(0, now - inactivityStart) / config.inactivityTaxPeriodMs);
  const alreadyChargedPeriods = integer(row.inactivity_tax_periods);
  const periods = Math.max(0, duePeriods - alreadyChargedPeriods);

  if (!periods) return { profile, charged: 0, periods: 0 };

  const settle = db.transaction(() => {
    let balance = integer(db.prepare("SELECT cookies FROM usuarios WHERE id = ?").get(profile.id)?.cookies);
    let charged = 0;
    for (let index = 0; index < periods && balance > config.dailyTaxGraceBalance; index++) {
      const periodTax = Math.min(
        config.dailyTaxMax,
        Math.max(1, Math.floor((balance - config.dailyTaxGraceBalance) * config.dailyTaxRate))
      );
      const actualTax = Math.min(balance - config.dailyTaxGraceBalance, periodTax);
      balance -= actualTax;
      charged += actualTax;
    }

    if (charged > 0) {
      addBalance(profile.id, -charged);
      updateStats(profile.id, { total_spent: charged, cookies_lost: charged });
      pushTransaction("inactivity_tax", profile.id, -charged, {
        note: `${periods} período(s) de 25 dias sem /daily`,
      });
    }

    db.prepare(`
      UPDATE usuarios
      SET inactivity_tax_periods = ?, last_tax_at = ?, updated_at = ?
      WHERE id = ?
    `).run(duePeriods, now, now, profile.id);

    return charged;
  });
  const charged = settle();
  return { profile: getById(profile.id), charged, periods };
}

// ─── Usuário ──────────────────────────────────────────────────────────────────

function getUser(user) {
  const config = getEconomyConfig();
  const id = String(user.id);
  const now = Date.now();

  db.prepare(`
    INSERT INTO usuarios (id, username, cookies, last_tax_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username   = excluded.username,
      updated_at = excluded.updated_at
  `).run(id, getUsername(user), config.startBalance, now, now, now);

  applyDailyTax(id);

  return rowToProfile(db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id));
}

function getProfile(user) {
  return getUser(user);
}

function setBalance(user, amount) {
  const balance = Math.max(0, Math.min(getEconomyConfig().maxCookieAmount, Math.floor(Number(amount))));
  const profile = getUser(user);
  db.prepare("UPDATE usuarios SET cookies = ?, updated_at = ? WHERE id = ?")
    .run(balance, Date.now(), profile.id);
  return getById(profile.id);
}

// ─── Daily com multiplicador de streak ───────────────────────────────────────

function claimDaily(user, details: TransactionDetails = {}) {
  return db.transaction(() => {
  const config = getEconomyConfig();
  const profile = getUser(user);
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

  const streak = previousDaily && now - previousDaily.createdAt <= config.dailyStreakWindowMs
    ? profile.dailyStreak + 1
    : 1;
  const base = randomAmount(config.dailyMinReward, config.dailyMaxReward);
  const dailyBaseReward = applyCookieBonuses(profile.id, base);
  const dailyBoost = applyPermanentDailyBoost(profile.id, details.guildId, dailyBaseReward);
  const dailyReward = dailyBoost.reward;
  const streakBonus = streak % config.dailyMilestoneDays === 0
    ? randomAmount(config.dailyMilestoneMin, config.dailyMilestoneMax)
    : 0;
  const milestoneBaseReward = streakBonus ? applyCookieBonuses(profile.id, streakBonus) : 0;
  const milestoneReward = streakBonus
    ? applyPermanentDailyBoost(profile.id, details.guildId, milestoneBaseReward).reward
    : 0;
  const reward = dailyReward + milestoneReward;
  const nextAt = cooldowns.consume(profile.id, "daily");

  addBalance(profile.id, reward);
  updateStats(profile.id, {
    cookies_won: reward,
    total_earned: reward,
    daily_claims: 1,
  });
  setStat(profile.id, "daily_streak", streak);
  if (streak > profile.bestDailyStreak) setStat(profile.id, "best_daily_streak", streak);
  pushTransaction("daily", profile.id, dailyReward, details);
  if (milestoneReward) {
    pushTransaction("daily_streak_bonus", profile.id, milestoneReward, {
      ...details,
      note: `Bônus de sequência diária: ${streak} dias`,
    });
  }
  db.prepare("UPDATE usuarios SET inactivity_tax_periods = 0 WHERE id = ?").run(profile.id);

  return {
    claimed: true,
    profile: getById(profile.id),
    reward,
    perkBonus: dailyReward - base + milestoneReward - streakBonus,
    base,
    streakBonus: milestoneReward,
    milestoneReward,
    streak,
    dailyMultiplier: dailyBoost.multiplier,
    nextAt,
  };
  })();
}

function getDailyStreak(user) {
  const config = getEconomyConfig();
  const profile = getUser(user);
  const lastDaily = db.prepare(`
    SELECT created_at AS createdAt
    FROM transacoes
    WHERE user_id = ? AND tipo = 'daily'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(profile.id);
  const active = Boolean(lastDaily && Date.now() - lastDaily.createdAt <= config.dailyStreakWindowMs);

  return {
    profile,
    streak: active ? profile.dailyStreak : 0,
    bestStreak: profile.bestDailyStreak,
    active,
    nextMilestone: active
      ? config.dailyMilestoneDays - (profile.dailyStreak % config.dailyMilestoneDays)
      : config.dailyMilestoneDays,
  };
}

// ─── Work ─────────────────────────────────────────────────────────────────────

function work(user, details: TransactionDetails = {}) {
  return db.transaction(() => {
    const config = getEconomyConfig();
    const profile = getUser(user);
    const cooldown = cooldowns.check(profile.id, "trabalhar");

    if (!cooldown.ready) {
      return {
        worked: false,
        profile,
        remaining: cooldown.remaining,
        nextAt: cooldown.expiresAt,
      };
    }

    const nextAt = cooldowns.consume(profile.id, "trabalhar");
    const settleWork = db.transaction(() => {
      const currentProfile = getById(profile.id);
      updateStats(profile.id, { work_count: 1 });

      const randomValues: [number, number, number, number, number, number] = [
        Math.random(),
        Math.random(),
        Math.random(),
        Math.random(),
        Math.random(),
        Math.random(),
      ];
      const nativeRoll = resolveNativeWorkRoll(randomValues);
      const roll = randomValues[0];
      const professionIndex = nativeRoll?.professionIndex
        ?? Math.floor(randomValues[1] * WORK_PROFESSIONS.length);
      const profession = WORK_PROFESSIONS[professionIndex];
      const event = nativeRoll?.event
        ?? (roll < 0.15 ? "dismissal" : roll >= 0.90 ? "tool_break" : roll < 0.20 ? "critical" : "success");
      const nativeLoss = event === "dismissal"
        ? randomAmount(config.workMinLoss, config.workMaxLoss)
        : randomAmount(config.workToolMinLoss, config.workToolMaxLoss);

      if (event === "dismissal") {
        const loss = Math.min(
          currentProfile.balance,
          nativeRoll ? nativeLoss : randomAmount(config.workMinLoss, config.workMaxLoss),
        );
        if (loss > 0) {
          addBalance(profile.id, -loss);
          updateStats(profile.id, { cookies_lost: loss, total_spent: loss });
          pushTransaction("work_dismissal", profile.id, -loss, {
            ...details,
            note: `Demitido(a): ${details.reason || details.note || "desempenho inadequado"}`,
          });
        }

        return {
          worked: true,
          success: false,
          profile: getById(profile.id),
          loss,
          reason: details.reason || null,
          job: details.job || null,
          event,
          nextAt,
        };
      }

      if (event === "tool_break") {
        const loss = Math.min(
          currentProfile.balance,
          nativeRoll ? nativeLoss : randomAmount(config.workToolMinLoss, config.workToolMaxLoss),
        );
        if (loss > 0) {
          addBalance(profile.id, -loss);
          updateStats(profile.id, { cookies_lost: loss, total_spent: loss });
          pushTransaction("work_tool_break", profile.id, -loss, {
            ...details,
            note: "Ferramenta quebrada durante o expediente",
          });
        }

        return {
          worked: true,
          success: false,
          event,
          profile: getById(profile.id),
          loss,
          job: `${profession[0]} ${profession[1]}`,
          nextAt,
        };
      }

      const baseReward = nativeRoll?.baseReward
        ?? randomAmount(profession[2], profession[3]);
      const reward = applyCookieBonuses(profile.id, baseReward);
      const critical = event === "critical";
      const bonus = nativeRoll?.bonus ?? (critical ? randomAmount(100, 300) : 0);
      const totalReward = critical ? reward * 2 + bonus : reward;
      addBalance(profile.id, totalReward);
      updateStats(profile.id, { cookies_won: totalReward, total_earned: totalReward });
      pushTransaction("work", profile.id, totalReward, {
        ...details,
        note: `${profession[0]}${critical ? " (sucesso crítico)" : ""}`,
      });

      return {
        worked: true,
        success: true,
        event,
        profile: getById(profile.id),
        reward: totalReward,
        baseReward,
        bonus,
        perkBonus: reward - baseReward,
        job: `${profession[0]} ${profession[1]}`,
        nextAt,
      };
    });

    return settleWork();
  })();
}

// ─── Bonus ────────────────────────────────────────────────────────────────────

function claimBonus(user, details: TransactionDetails = {}) {
  const profile = getUser(user);
  const cooldown = cooldowns.check(profile.id, "bonus");

  if (!cooldown.ready) {
    return {
      claimed: false,
      profile,
      remaining: cooldown.remaining,
      nextAt: cooldown.expiresAt,
    };
  }

  const baseReward = randomAmount(150, 450);
  const reward = applyCookieBonuses(profile.id, baseReward);
  const nextAt = cooldowns.consume(profile.id, "bonus");

  addBalance(profile.id, reward);
  updateStats(profile.id, {
    bonus_claims: 1,
    cookies_won: reward,
    total_earned: reward,
  });
  pushTransaction("bonus", profile.id, reward, details);

  return {
    claimed: true,
    profile: getById(profile.id),
    reward,
    perkBonus: reward - baseReward,
    nextAt,
  };
}

// ─── Roubo balanceado ─────────────────────────────────────────────────────────

function rob(thiefUser, targetUser, details: TransactionDetails = {}) {
  const config = getEconomyConfig();
  const thief = getUser(thiefUser);
  const target = getUser(targetUser);

  if (thief.id === target.id) {
    return { ok: false, reason: "self", thief, target };
  }

  const prison = blackMarket.getActivePrisonStatus(thief.id);
  if (prison) return { ok: false, reason: "prison", thief, target, prison };

  if (target.balance < config.robMinTargetBalance) {
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

  return db.transaction(() => {
    const nextAt = cooldowns.consume(thief.id, "roubar");
    const guildId = String(details.guildId || PRIMARY_GUILD_ID);
    const cameraUsed = blackMarket.consumeInventoryItem(target.id, "camera");
    updateStats(thief.id, { rob_count: 1 });

    if (cameraUsed) {
      pushTransaction("rob_blocked", thief.id, 0, {
        ...details,
        targetId: target.id,
        note: "O roubo foi bloqueado por uma câmera de segurança",
      });
      pushTransaction("rob_camera_protection", target.id, 0, {
        ...details,
        targetId: thief.id,
        note: "Câmera de Segurança bloqueou uma tentativa de roubo",
      });
      return {
        ok: true,
        success: false,
        protected: true,
        thief: getById(thief.id),
        target: getById(target.id),
        nextAt,
      };
    }

    const crowbarUsed = blackMarket.consumeInventoryItem(thief.id, "crowbar");
    const chance = Math.min(0.95, config.robSuccessChance + (crowbarUsed ? 0.1 : 0));
    const success = Math.random() < chance;

    if (success) {
      const percent = randomAmount(config.robStealMinPct, config.robStealMaxPct);
      const stolen = Math.max(1, Math.floor(target.balance * (percent / 100)));

      addBalance(target.id, -stolen);
      addBalance(thief.id, stolen);
      updateStats(thief.id, { rob_wins: 1, cookies_won: stolen, total_earned: stolen });
      updateStats(target.id, { cookies_lost: stolen, total_spent: stolen });
      pushTransaction("rob_win", thief.id, stolen, {
        ...details,
        targetId: target.id,
        note: `${percent}%${crowbarUsed ? "; pé de cabra" : ""}`,
      });
      pushTransaction("rob_loss_target", target.id, -stolen, {
        ...details,
        targetId: thief.id,
        note: `${percent}%`,
      });

      return {
        ok: true,
        success: true,
        thief: getById(thief.id),
        target: getById(target.id),
        stolen,
        percent,
        chance,
        crowbarUsed,
        nextAt,
      };
    }

    let penalty = randomAmount(config.robPenaltyMin, config.robPenaltyMax);
    if (config.robPenaltyScale) {
      const scaledMax = Math.max(config.robPenaltyMin, Math.floor(thief.balance * 0.10));
      penalty = Math.min(penalty, scaledMax, thief.balance);
    }
    penalty = Math.min(thief.balance, Math.max(0, penalty));
    const lawyerUsed = blackMarket.consumeInventoryItem(thief.id, "lawyer");
    const jail = blackMarket.recordRobberyJail(thief.id, guildId, Date.now(), lawyerUsed);

    addBalance(thief.id, -penalty);
    updateStats(thief.id, { rob_losses: 1, cookies_lost: penalty, total_spent: penalty });
    pushTransaction("rob_fail", thief.id, -penalty, {
      ...details,
      targetId: target.id,
      note: `Pego${crowbarUsed ? " (pé de cabra consumido)" : ""}; preso por 3 horas; fiança de ${jail.bailAmount} cookies${lawyerUsed ? " (advogado aplicado)" : ""}`,
    });

    return {
      ok: true,
      success: false,
      thief: getById(thief.id),
      target,
      penalty,
      jail,
      lawyerUsed,
      crowbarUsed,
      nextAt,
    };
  })();
}

// ─── Rifa ─────────────────────────────────────────────────────────────────────

function playRifa(user, amount, details: TransactionDetails = {}) {
  const value = cleanAmount(amount);
  const profile = getUser(user);

  if (profile.balance < value) {
    return { ok: false, reason: "balance", profile, amount: value };
  }

  if (Math.random() < 0.4) {
    const profit = value;
    const prize = value * 2;

    addBalance(profile.id, profit);
    updateStats(profile.id, { rifa_wins: 1, cookies_won: profit, total_earned: profit });
    if (prize > profile.biggestWin) setStat(profile.id, "biggest_win", prize);
    pushTransaction("rifa_win", profile.id, profit, details);

    return { ok: true, won: true, profile: getById(profile.id), amount: value, prize };
  }

  addBalance(profile.id, -value);
  updateStats(profile.id, { rifa_losses: 1, cookies_lost: value, total_spent: value });
  pushTransaction("rifa_loss", profile.id, -value, details);

  return { ok: true, won: false, profile: getById(profile.id), amount: value };
}

// ─── Rep ──────────────────────────────────────────────────────────────────────

function giveRep(fromUser, toUser, details: TransactionDetails = {}) {
  const from = getUser(fromUser);
  const to = getUser(toUser);

  if (from.id === to.id) return { ok: false, reason: "self", from, to };

  const cooldown = cooldowns.check(from.id, "rep");
  if (!cooldown.ready) {
    return { ok: false, reason: "cooldown", from, to, remaining: cooldown.remaining, nextAt: cooldown.expiresAt };
  }

  const nextAt = cooldowns.consume(from.id, "rep");

  updateStats(from.id, { reps_given: 1 });
  updateStats(to.id, { reputacao: 1 });
  pushTransaction("rep", from.id, 0, { ...details, targetId: to.id });

  return { ok: true, from: getById(from.id), to: getById(to.id), nextAt };
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

function transferTax(amount) {
  const value = integer(amount);
  if (value <= 10000) return 0;
  if (value <= 50000) return Math.floor(value * 0.02);
  return Math.floor(value * 0.05);
}

function transfer(fromUser, toUser, amount, details: TransactionDetails = {}) {
  const requested = Number(amount);
  if (!Number.isSafeInteger(requested) || requested <= 0) {
    return { ok: false, reason: "amount", from: getUser(fromUser), to: getUser(toUser) };
  }

  const tax = transferTax(requested);
  const value = requested - tax;
  if (value <= 0) return { ok: false, reason: "amount", from: getUser(fromUser), to: getUser(toUser) };
  const from = getUser(fromUser);
  const to = getUser(toUser);
  if (from.id === to.id) return { ok: false, reason: "self", from, to };

  const transferAtomically = db.transaction(() => {
    const sender = db.prepare("SELECT cookies FROM usuarios WHERE id = ?").get(from.id);
    if (!sender || integer(sender.cookies) < value) return false;

    const debit = db.prepare(`
      UPDATE usuarios SET cookies = cookies - ?, updated_at = ?
      WHERE id = ? AND cookies >= ?
    `).run(requested, Date.now(), from.id, requested);
    if (debit.changes !== 1) return false;

    const credit = db.prepare(`
      UPDATE usuarios SET cookies = cookies + ?, updated_at = ? WHERE id = ?
    `).run(value, Date.now(), to.id);
    if (credit.changes !== 1) throw new Error("Destinatário da transferência não encontrado.");

    updateStats(from.id, { transfers_sent: 1, transferred_out: value, total_spent: value });
    updateStats(to.id, { transfers_received: 1, transferred_in: value, total_earned: value });
    pushTransaction("transfer_out", from.id, -value, { ...details, targetId: to.id });
    pushTransaction("transfer_in", to.id, value, { ...details, targetId: from.id });
    if (tax > 0) {
      updateStats(from.id, { total_spent: tax });
      pushTransaction("transfer_tax", from.id, -tax, {
        ...details,
        note: `Imposto progressivo de ${tax} cookies`,
      });
    }
    return true;
  });

  if (!transferAtomically()) {
    return { ok: false, reason: "balance", from: getById(from.id), to: getById(to.id) };
  }

  return { ok: true, from: getById(from.id), to: getById(to.id), amount: value, requested, tax };
}

// ─── Apostas ──────────────────────────────────────────────────────────────────

function settleBet(user, amount, result, details: TransactionDetails = {}) {
  const value = cleanAmount(amount);
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

function settleDuel(winnerUser, loserUser, amount, details: TransactionDetails = {}) {
  const value = cleanAmount(amount);
  const winner = getUser(winnerUser);
  const loser = getUser(loserUser);

  addBalance(winner.id, value);
  addBalance(loser.id, -value);
  updateStats(winner.id, { games_played: 1, bet_wins: 1, cookies_won: value, total_earned: value });
  updateStats(loser.id, { games_played: 1, bet_losses: 1, cookies_lost: value, total_spent: value });
  if (value > winner.biggestWin) setStat(winner.id, "biggest_win", value);
  pushTransaction("duel_win", winner.id, value, { ...details, targetId: loser.id });
  pushTransaction("duel_loss", loser.id, -value, { ...details, targetId: winner.id });

  return { winner: getById(winner.id), loser: getById(loser.id) };
}

function settleDraw(userA, userB, details: TransactionDetails = {}) {
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
    earned: "total_earned",
    wins: "bet_wins",
    played: "games_played",
    profit: "(cookies_won - cookies_lost)",
  }[type] || "cookies";

  return db.prepare(`SELECT * FROM usuarios ORDER BY ${orderBy} DESC LIMIT ?`)
    .all(integer(limit, 10))
    .map(rowToProfile);
}

function getHistoryCount(user, guildId = null) {
  if (guildId) {
    return integer(db.prepare("SELECT COUNT(*) AS count FROM transacoes WHERE guild_id = ?")
      .get(String(guildId))?.count);
  }
  return integer(db.prepare("SELECT COUNT(*) AS count FROM transacoes WHERE user_id = ?")
    .get(String(user.id))?.count);
}

function getHistory(user, limit = 10, offset = 0, guildId = null) {
  const query = guildId
    ? `SELECT tipo AS type, user_id AS userId, amount, guild_id AS guildId, guild_name AS guildName, target_id AS targetId, note, created_at AS createdAt
       FROM transacoes WHERE guild_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    : `SELECT tipo AS type, user_id AS userId, amount, guild_id AS guildId, guild_name AS guildName, target_id AS targetId, note, created_at AS createdAt
       FROM transacoes WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;

  const param = guildId ? String(guildId) : String(user.id);
  return db.prepare(query).all(param, Math.max(1, integer(limit, 10)), Math.max(0, integer(offset)));
}

function getNetProfit(profile) {
  return integer(profile.cookiesWon) - integer(profile.cookiesLost);
}

function getShopInventory(userId) {
  return db.prepare(`
    SELECT item_id AS itemId, quantity, purchased_at AS purchasedAt
    FROM cookie_shop_inventory
    WHERE user_id = ? AND quantity > 0
    ORDER BY purchased_at ASC
  `).all(String(userId));
}

function purchaseShopItem(user, itemId, details: TransactionDetails = {}) {
  const item = SHOP_ITEMS_BY_ID[itemId];
  if (!item) return { ok: false, reason: "invalid_item" };

  const profile = getUser(user);
  const userId = profile.id;
  const purchase = db.transaction(() => {
    const owned = db.prepare(`
      SELECT quantity FROM cookie_shop_inventory WHERE user_id = ? AND item_id = ?
    `).get(userId, item.id);
    const isVip = Boolean(db.prepare("SELECT vip FROM usuarios WHERE id = ?").get(userId)?.vip);

    if ((item.kind === "color" && owned?.quantity > 0) || (item.kind === "vip" && isVip)) {
      return { ok: false, reason: "owned", profile: getById(userId), item };
    }

    const debit = db.prepare(`
      UPDATE usuarios
      SET cookies = cookies - ?,
          cookies_lost = cookies_lost + ?,
          total_spent = total_spent + ?,
          updated_at = ?
      WHERE id = ? AND cookies >= ?
    `).run(item.price, item.price, item.price, Date.now(), userId, item.price);

    if (debit.changes === 0) {
      return { ok: false, reason: "balance", profile: getById(userId), item };
    }

    const now = Date.now();
    if (item.kind === "vip") {
      db.prepare("UPDATE usuarios SET vip = 1, updated_at = ? WHERE id = ?").run(now, userId);
    } else {
      db.prepare(`
        INSERT INTO cookie_shop_inventory (user_id, item_id, quantity, purchased_at)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(user_id, item_id)
        DO UPDATE SET quantity = cookie_shop_inventory.quantity + 1
      `).run(userId, item.id, now);
    }
    pushTransaction("shop_purchase", userId, -item.price, {
      ...details,
      note: item.name,
    });

    return { ok: true, item, profile: getById(userId) };
  });

  return purchase();
}

function getGuildShopRolePurchases(guildId, userId) {
  return db.prepare("SELECT role_id AS roleId, kind, price, purchased_at AS purchasedAt, expires_at AS expiresAt FROM guild_shop_role_purchases WHERE guild_id = ? AND user_id = ? ORDER BY purchased_at DESC")
    .all(String(guildId), String(userId));
}

function getGuildShopRolePurchase(guildId, userId, roleId, kind) {
  return db.prepare("SELECT role_id AS roleId, kind, price, purchased_at AS purchasedAt, expires_at AS expiresAt FROM guild_shop_role_purchases WHERE guild_id = ? AND user_id = ? AND role_id = ? AND kind = ?")
    .get(String(guildId), String(userId), String(roleId), String(kind)) || null;
}

function purchaseCooldownUnlock(user, targets, price, details: TransactionDetails = {}) {
  const eligibleTargets = [...new Set((Array.isArray(targets) ? targets : [targets]).map(String))]
    .filter(target => ["daily", "roubar", "trabalhar"].includes(target) && cooldowns.DURATIONS[target]);
  const cost = Math.max(0, integer(price));
  if (!eligibleTargets.length || !cost) return { ok: false, reason: "invalid_offer" };

  const profile = getUser(user);
  return db.transaction(() => {
    const activeTargets = eligibleTargets.filter(target => !cooldowns.check(profile.id, target).ready);
    if (!activeTargets.length) return { ok: false, reason: "cooldown_ready", profile: getById(profile.id) };

    const now = Date.now();
    const debit = db.prepare("UPDATE usuarios SET cookies = cookies - ?, cookies_lost = cookies_lost + ?, total_spent = total_spent + ?, updated_at = ? WHERE id = ? AND cookies >= ?")
      .run(cost, cost, cost, now, profile.id, cost);
    if (!debit.changes) return { ok: false, reason: "balance", profile: getById(profile.id) };

    const cooldownColumns = {
      daily: "cooldown_daily",
      roubar: "cooldown_roubar",
      trabalhar: "cooldown_trabalhar",
    };
    for (const target of activeTargets) {
      db.prepare("DELETE FROM cooldowns WHERE user_id = ? AND comando = ?")
        .run(profile.id, target);
      db.prepare(`UPDATE usuarios SET ${cooldownColumns[target]} = 0, updated_at = ? WHERE id = ?`)
        .run(now, profile.id);
    }
    pushTransaction("shop_cooldown_unlock", profile.id, -cost, {
      ...details,
      note: "Acelerador: " + activeTargets.join(", "),
    });
    return { ok: true, targets: activeTargets, profile: getById(profile.id) };
  })();
}

function openShopChest(user, itemId, details: TransactionDetails = {}) {
  const item = SHOP_ITEMS_BY_ID[itemId];
  if (!item || item.kind !== "chest") return { ok: false, reason: "invalid_chest" };

  const profile = getUser(user);
  const open = db.transaction(() => {
    const inventory = db.prepare(`
      SELECT quantity FROM cookie_shop_inventory WHERE user_id = ? AND item_id = ?
    `).get(profile.id, item.id);

    if (!inventory?.quantity) return { ok: false, reason: "no_chest", item };

    const consumed = db.prepare(`
      UPDATE cookie_shop_inventory SET quantity = quantity - 1
      WHERE user_id = ? AND item_id = ? AND quantity > 0
    `).run(profile.id, item.id);
    if (!consumed.changes) return { ok: false, reason: "no_chest", item };

    db.prepare("DELETE FROM cookie_shop_inventory WHERE user_id = ? AND item_id = ? AND quantity <= 0")
      .run(profile.id, item.id);

    const baseCookieReward = randomAmount(item.minReward, item.maxReward);
    const cookieReward = applyCookieBonuses(profile.id, baseCookieReward);
    let colorReward = null;
    let duplicateColorBonus = 0;

    if (item.colorDropChance && Math.random() < item.colorDropChance) {
      const ownedColors = new Set(db.prepare(`
        SELECT item_id FROM cookie_shop_inventory WHERE user_id = ? AND quantity > 0
      `).all(profile.id).map(row => row.item_id));
      const availableColors = COLOR_ITEMS.filter(color => !ownedColors.has(color.id));

      if (availableColors.length) {
        colorReward = availableColors[Math.floor(Math.random() * availableColors.length)];
        db.prepare(`
          INSERT INTO cookie_shop_inventory (user_id, item_id, quantity, purchased_at)
          VALUES (?, ?, 1, ?)
          ON CONFLICT(user_id, item_id) DO NOTHING
        `).run(profile.id, colorReward.id, Date.now());
      } else {
        duplicateColorBonus = item.duplicateCompensation;
      }
    }

    const totalReward = cookieReward + duplicateColorBonus;
    addBalance(profile.id, totalReward);
    updateStats(profile.id, { cookies_won: totalReward, total_earned: totalReward });
    pushTransaction("shop_chest_open", profile.id, totalReward, {
      ...details,
      note: item.name,
    });

    if (colorReward) {
      pushTransaction("shop_color_drop", profile.id, 0, {
        ...details,
        note: colorReward.name,
      });
    }

    return {
      ok: true,
      item,
      cookieReward,
      baseCookieReward,
      colorReward,
      duplicateColorBonus,
      profile: getById(profile.id),
    };
  });

  return open();
}

function useShopCooldownPass(user, itemId, target, details: TransactionDetails = {}) {
  const item = SHOP_ITEMS_BY_ID[itemId];
  if (!item || item.kind !== "cooldown_pass") return { ok: false, reason: "invalid_item" };
  if (!COOLDOWN_TARGETS.some(entry => entry.id === target) || !cooldowns.DURATIONS[target]) {
    return { ok: false, reason: "invalid_target" };
  }

  const profile = getUser(user);
  const use = db.transaction(() => {
    const activeCooldown = cooldowns.check(profile.id, target);
    if (activeCooldown.ready) {
      return { ok: false, reason: "cooldown_ready", profile: getById(profile.id) };
    }

    const consumed = db.prepare(`
      UPDATE cookie_shop_inventory SET quantity = quantity - 1
      WHERE user_id = ? AND item_id = ? AND quantity > 0
    `).run(profile.id, item.id);

    if (!consumed.changes) return { ok: false, reason: "no_pass", profile: getById(profile.id) };

    db.prepare("DELETE FROM cookie_shop_inventory WHERE user_id = ? AND item_id = ? AND quantity <= 0")
      .run(profile.id, item.id);
    cooldowns.clear(profile.id, target);
    pushTransaction("shop_cooldown_reset", profile.id, 0, {
      ...details,
      note: target,
    });

    return {
      ok: true,
      remaining: activeCooldown.remaining,
      target,
      profile: getById(profile.id),
    };
  });

  return use();
}

function activateCookieBoost(user, itemId, details: TransactionDetails = {}) {
  const item = SHOP_ITEMS_BY_ID[itemId];
  if (!item || item.kind !== "cookie_boost") return { ok: false, reason: "invalid_item" };

  const profile = getUser(user);
  const activate = db.transaction(() => {
    const consumed = db.prepare(`
      UPDATE cookie_shop_inventory SET quantity = quantity - 1
      WHERE user_id = ? AND item_id = ? AND quantity > 0
    `).run(profile.id, item.id);
    if (!consumed.changes) return { ok: false, reason: "no_boost", profile: getById(profile.id) };

    db.prepare("DELETE FROM cookie_shop_inventory WHERE user_id = ? AND item_id = ? AND quantity <= 0")
      .run(profile.id, item.id);
    const now = Date.now();
    const oldExpiry = getById(profile.id).cookieBoostUntil;
    const expiresAt = Math.max(now, oldExpiry) + item.duration;
    db.prepare("UPDATE usuarios SET cookie_boost_until = ?, updated_at = ? WHERE id = ?")
      .run(expiresAt, now, profile.id);
    pushTransaction("shop_cookie_boost", profile.id, 0, {
      ...details,
      note: item.name,
    });

    return { ok: true, expiresAt, profile: getById(profile.id) };
  });

  return activate();
}

function equipShopItem(user, itemId) {
  const profile = getUser(user);
  if (itemId !== "default" && SHOP_ITEMS_BY_ID[itemId]?.kind !== "color") {
    return { ok: false, reason: "invalid_item", profile };
  }

  if (itemId !== "default") {
    const owned = db.prepare(`
      SELECT 1 FROM cookie_shop_inventory WHERE user_id = ? AND item_id = ? AND quantity > 0
    `).get(profile.id, itemId);
    if (!owned) return { ok: false, reason: "not_owned", profile };
  }

  db.prepare("UPDATE usuarios SET selected_banner = ?, updated_at = ? WHERE id = ?")
    .run(itemId, Date.now(), profile.id);

  return {
    ok: true,
    item: itemId === "default" ? null : SHOP_ITEMS_BY_ID[itemId],
    profile: getById(profile.id),
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  START_BALANCE,
  addBalance,
  activateCookieBoost,
  applyCookieBonuses,
  updateStats,
  pushTransaction,
  claimBonus,
  claimDaily,
  getDailyStreak,
  giveRep,
  getById,
  getHistory,
  getHistoryCount,
  getGuildShopRolePurchase,
  getGuildShopRolePurchases,
  getNetProfit,
  getProfile,
  setBalance,
  getRank,
  getShopInventory,
  getUser,
  openShopChest,
  playRifa,
  purchaseShopItem,
  purchaseCooldownUnlock,
  rob,
  settleBet,
  settleDraw,
  settleDuel,
  transfer,
  equipShopItem,
  useShopCooldownPass,
  work,
};
