const db = require("./db");

export interface EconomyConfig {
  startBalance: number;
  maxCookieAmount: number;
  dailyMinReward: number;
  dailyMaxReward: number;
  dailyStreakWindowMs: number;
  dailyMilestoneDays: number;
  dailyMilestoneMin: number;
  dailyMilestoneMax: number;
  workMinLoss: number;
  workMaxLoss: number;
  workToolMinLoss: number;
  workToolMaxLoss: number;
  robMinTargetBalance: number;
  robSuccessChance: number;
  robStealMinPct: number;
  robStealMaxPct: number;
  robPenaltyMin: number;
  robPenaltyMax: number;
  robPenaltyScale: boolean;
  dailyTaxRate: number;
  dailyTaxMax: number;
  dailyTaxGraceBalance: number;
  inactivityTaxPeriodMs: number;
}

const DEFAULTS: EconomyConfig = {
  startBalance: 100,
  maxCookieAmount: 2_147_483_647,
  dailyMinReward: 900,
  dailyMaxReward: 1800,
  dailyStreakWindowMs: 48 * 60 * 60 * 1000,
  dailyMilestoneDays: 5,
  dailyMilestoneMin: 1000,
  dailyMilestoneMax: 3000,
  workMinLoss: 300,
  workMaxLoss: 800,
  workToolMinLoss: 100,
  workToolMaxLoss: 300,
  robMinTargetBalance: 50,
  robSuccessChance: 0.45,
  robStealMinPct: 8,
  robStealMaxPct: 20,
  robPenaltyMin: 100,
  robPenaltyMax: 500,
  robPenaltyScale: true,
  dailyTaxRate: 0.01,
  dailyTaxMax: 250,
  dailyTaxGraceBalance: 500,
  inactivityTaxPeriodMs: 25 * 24 * 60 * 60 * 1000,
};

type EconomyConfigKey = keyof EconomyConfig;

const DATABASE_KEYS: Record<EconomyConfigKey, string> = {
  startBalance: "economy.start_balance",
  maxCookieAmount: "economy.max_cookie_amount",
  dailyMinReward: "economy.daily_min_reward",
  dailyMaxReward: "economy.daily_max_reward",
  dailyStreakWindowMs: "economy.daily_streak_window_ms",
  dailyMilestoneDays: "economy.daily_milestone_days",
  dailyMilestoneMin: "economy.daily_milestone_min",
  dailyMilestoneMax: "economy.daily_milestone_max",
  workMinLoss: "economy.work_min_loss",
  workMaxLoss: "economy.work_max_loss",
  workToolMinLoss: "economy.work_tool_min_loss",
  workToolMaxLoss: "economy.work_tool_max_loss",
  robMinTargetBalance: "economy.rob_min_target_balance",
  robSuccessChance: "economy.rob_success_chance",
  robStealMinPct: "economy.rob_steal_min_pct",
  robStealMaxPct: "economy.rob_steal_max_pct",
  robPenaltyMin: "economy.rob_penalty_min",
  robPenaltyMax: "economy.rob_penalty_max",
  robPenaltyScale: "economy.rob_penalty_scale",
  dailyTaxRate: "economy.daily_tax_rate",
  dailyTaxMax: "economy.daily_tax_max",
  dailyTaxGraceBalance: "economy.daily_tax_grace_balance",
  inactivityTaxPeriodMs: "economy.inactivity_tax_period_ms",
};

function parseValue(value: unknown, fallback: number | boolean): number | boolean {
  if (typeof fallback === "boolean") {
    if (value === "1" || value === "true") return true;
    if (value === "0" || value === "false") return false;
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validateConfig(config: EconomyConfig): EconomyConfig {
  if (config.startBalance < 0 || config.maxCookieAmount < config.startBalance) {
    throw new Error("Configuração econômica inválida: limites de saldo.");
  }
  if (config.dailyMinReward < 0 || config.dailyMaxReward < config.dailyMinReward) {
    throw new Error("Configuração econômica inválida: recompensa diária.");
  }
  if (config.dailyMilestoneDays < 1 || config.dailyMilestoneMin < 0 || config.dailyMilestoneMax < config.dailyMilestoneMin) {
    throw new Error("Configuração econômica inválida: marco diário.");
  }
  if (config.robSuccessChance < 0 || config.robSuccessChance > 1) {
    throw new Error("Configuração econômica inválida: chance de roubo.");
  }
  if (config.robStealMinPct < 0 || config.robStealMaxPct < config.robStealMinPct) {
    throw new Error("Configuração econômica inválida: percentual de roubo.");
  }
  if (config.dailyTaxRate < 0 || config.dailyTaxMax < 0 || config.dailyTaxGraceBalance < 0) {
    throw new Error("Configuração econômica inválida: imposto.");
  }
  return config;
}

export function getEconomyConfig(): EconomyConfig {
  const rows = db.prepare(`
    SELECT key, value
    FROM system_settings
    WHERE key LIKE 'economy.%'
  `).all() as Array<{ key: string; value: string }>;
  const stored = new Map(rows.map(row => [row.key, row.value]));
  const config = { ...DEFAULTS };

  for (const key of Object.keys(DEFAULTS) as EconomyConfigKey[]) {
    const storedValue = stored.get(DATABASE_KEYS[key]);
    if (storedValue !== undefined) {
      config[key] = parseValue(storedValue, DEFAULTS[key]) as never;
    }
  }

  return validateConfig(config);
}

export function setEconomyConfig(key: EconomyConfigKey, value: number | boolean): EconomyConfig {
  const fallback = DEFAULTS[key];
  if (typeof value !== typeof fallback || (typeof value === "number" && !Number.isFinite(value))) {
    throw new TypeError(`Valor inválido para economia.${key}.`);
  }
  validateConfig({ ...getEconomyConfig(), [key]: value });

  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(DATABASE_KEYS[key], String(value), Date.now());

  return getEconomyConfig();
}

export function economyConfigDefaults(): EconomyConfig {
  return { ...DEFAULTS };
}

module.exports = {
  economyConfigDefaults,
  getEconomyConfig,
  setEconomyConfig,
};
