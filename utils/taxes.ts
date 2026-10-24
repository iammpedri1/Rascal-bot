const db = require("./db");
const logger = require("./logger");
const { monthKey } = require("./messageStats");
const { pushTransaction } = require("./cookieEconomy");

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const ACCOUNTS_PER_PASS = 25;
const MONTHLY_TAX_RATE = 0.02;
const INACTIVITY_PERIOD_MS = 25 * 24 * 60 * 60 * 1000;
const { getUser } = require("./cookieEconomy");
const { getPrimaryGuild } = require("./primaryGuild");
let schedulerStarted = false;
let passRunning = false;
let inactivityPassRunning = false;

function previousMonthKey(current) {
  const [year, month] = current.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

function nextMonthKey(current) {
  const [year, month] = current.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}

function ensureActivationMonth() {
  const current = monthKey();
  db.prepare(`
    INSERT OR IGNORE INTO system_settings (key, value, updated_at)
    VALUES ('monthly_tax_activated_month', ?, ?)
  `).run(current, Date.now());
  return db.prepare(`SELECT value FROM system_settings WHERE key = 'monthly_tax_activated_month'`).get()?.value;
}

async function boosterStatus(client, userId) {
  const guild = getPrimaryGuild(client);
  if (!guild) return { ok: false, error: new Error("O servidor principal não está disponível.") };
  const cachedMember = guild.members.cache.get(String(userId));
  const premiumRoleId = guild.roles.premiumSubscriberRole?.id;
  if (cachedMember?.premiumSince || (premiumRoleId && cachedMember?.roles.cache.has(premiumRoleId))) {
    return { ok: true, exempt: true };
  }
  if (cachedMember) return { ok: true, exempt: false };
  try {
    const member = await guild.members.fetch({ user: String(userId), force: true });
    return { ok: true, exempt: Boolean(member.premiumSince || (premiumRoleId && member.roles.cache.has(premiumRoleId))) };
  } catch (error) {
    if ([10007, 10013].includes((error as any)?.code)) return { ok: true, exempt: false };
    return { ok: false, error };
  }
}

function settleAccount(month, userId, exempt) {
  return db.transaction(() => {
    const alreadyProcessed = db.prepare(`
      SELECT status FROM monthly_tax_accounts WHERE month_key = ? AND user_id = ?
    `).get(month, String(userId));
    if (alreadyProcessed) return false;

    const account = db.prepare("SELECT cookies FROM usuarios WHERE id = ?").get(String(userId));
    if (!account) return false;
    const balance = Math.max(0, Number(account.cookies) || 0);
    const amount = exempt ? 0 : Math.floor(balance * MONTHLY_TAX_RATE);
    if (amount > 0) {
      db.prepare(`
        UPDATE usuarios
        SET cookies = MAX(0, cookies - ?), cookies_lost = cookies_lost + ?,
            total_spent = total_spent + ?, updated_at = ?
        WHERE id = ?
      `).run(amount, amount, amount, Date.now(), String(userId));
      pushTransaction("monthly_tax", userId, -amount, { note: `Taxa mensal de 2% (${month})` });
    }
    db.prepare(`
      INSERT INTO monthly_tax_accounts (month_key, user_id, status, amount, processed_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(month, String(userId), exempt ? "exempt" : "taxed", amount, Date.now());
    return true;
  })();
}

async function processMonthlyTax(client) {
  if (passRunning) return;
  passRunning = true;
  try {
    const activationMonth = ensureActivationMonth();
    const latestClosedMonth = previousMonthKey(monthKey());
    if (!activationMonth || latestClosedMonth < activationMonth) return;
    const completedMonths = new Set(db.prepare(`
      SELECT month_key AS monthKey FROM monthly_tax_runs
      WHERE month_key >= ? AND month_key <= ?
    `).all(activationMonth, latestClosedMonth).map(row => row.monthKey));
    let targetMonth = activationMonth;
    while (targetMonth <= latestClosedMonth && completedMonths.has(targetMonth)) {
      targetMonth = nextMonthKey(targetMonth);
    }
    if (targetMonth > latestClosedMonth) return;
    if (db.prepare("SELECT 1 FROM monthly_tax_runs WHERE month_key = ?").get(targetMonth)) return;

    const accounts = db.prepare(`
      SELECT users.id
      FROM usuarios users
      LEFT JOIN monthly_tax_accounts processed
        ON processed.month_key = ? AND processed.user_id = users.id
      WHERE processed.user_id IS NULL
      ORDER BY users.id
      LIMIT ?
    `).all(targetMonth, ACCOUNTS_PER_PASS);

    if (!accounts.length) {
      const counts = db.prepare(`
        SELECT
          SUM(CASE WHEN status = 'taxed' THEN 1 ELSE 0 END) AS taxed,
          SUM(CASE WHEN status = 'exempt' THEN 1 ELSE 0 END) AS exempt
        FROM monthly_tax_accounts WHERE month_key = ?
      `).get(targetMonth);
      db.prepare(`
        INSERT OR IGNORE INTO monthly_tax_runs (month_key, completed_at, taxed_accounts, exempt_accounts)
        VALUES (?, ?, ?, ?)
      `).run(targetMonth, Date.now(), Number(counts?.taxed) || 0, Number(counts?.exempt) || 0);
      logger.success("Taxa mensal processada", { month: targetMonth, ...counts });
      return;
    }

    for (const { id } of accounts) {
      const status = await boosterStatus(client, id);
      if (!status.ok) {
        logger.warn("Taxa mensal pausada: não foi possível confirmar status Nitro", {
          month: targetMonth,
          userId: id,
          code: (status.error as any)?.code,
        });
        return;
      }
      settleAccount(targetMonth, id, status.exempt);
    }
  } finally {
    passRunning = false;
  }
}

function processInactivityTaxBatch() {
  if (inactivityPassRunning) return;
  inactivityPassRunning = true;
  try {
    const dueUsers = db.prepare(`
      SELECT users.id, users.username
      FROM usuarios users
      LEFT JOIN (
        SELECT user_id, MAX(created_at) AS last_daily
        FROM transacoes
        WHERE tipo = 'daily'
        GROUP BY user_id
      ) daily ON daily.user_id = users.id
      WHERE users.inactivity_tax_periods < CAST((? - COALESCE(daily.last_daily, users.created_at)) / ? AS INTEGER)
      ORDER BY COALESCE(daily.last_daily, users.created_at) ASC
      LIMIT ?
    `).all(Date.now(), INACTIVITY_PERIOD_MS, ACCOUNTS_PER_PASS);
    for (const user of dueUsers) getUser({ id: user.id, username: user.username || `usuario-${user.id}` });
  } finally {
    inactivityPassRunning = false;
  }
}

async function runScheduledTaxes(client) {
  await processMonthlyTax(client);
  processInactivityTaxBatch();
}

function startTaxScheduler(client) {
  if (schedulerStarted) return;
  schedulerStarted = true;
  void runScheduledTaxes(client).catch(error => logger.error("Falha ao processar taxas", error));
  const timer = setInterval(() => {
    void runScheduledTaxes(client).catch(error => logger.error("Falha ao processar taxas", error));
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
}

module.exports = { processInactivityTaxBatch, processMonthlyTax, startTaxScheduler };
