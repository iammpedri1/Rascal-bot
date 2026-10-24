import type { Guild, GuildMember, User } from "discord.js";
import type { SqliteDatabase } from "./sqliteTypes";

const db = require("./db") as SqliteDatabase;
const { guildRoleOffers } = require("./cookieShop") as {
  guildRoleOffers(guild: Guild, kind: "vip"): Array<{ roleId: string }>;
};

export const BLACK_MARKET_JAIL_MS = 3 * 60 * 60 * 1000;
export const BLACK_MARKET_BASE_BAIL = 10_000;
export const BLACK_MARKET_ITEMS = [
  {
    id: "crowbar",
    name: "Pé de Cabra",
    price: 6_500,
    emoji: "pand_happy",
    fallback: "🪛",
    description: "+10 pontos percentuais na chance do próximo roubo; consumido ao tentar.",
  },
  {
    id: "camera",
    name: "Câmera de Segurança",
    price: 8_000,
    emoji: "pand_police",
    fallback: "📹",
    description: "Bloqueia e é consumida no próximo roubo contra você.",
  },
  {
    id: "lawyer",
    name: "Advogado",
    price: 3_500,
    emoji: "heartmine",
    fallback: "⚖️",
    description: "Se for pego, reduz a fiança de 10.000 para 5.000 cookies.",
  },
] as const;

export type BlackMarketItemId = (typeof BLACK_MARKET_ITEMS)[number]["id"];

export interface PrisonStatus {
  userId: string;
  guildId: string;
  jailedAt: number;
  releaseAt: number;
  bailAmount: number;
}

export function isVipMember(guild: Guild, member: GuildMember): boolean {
  return guildRoleOffers(guild, "vip").some((offer) => member.roles.cache.has(offer.roleId));
}

export function getInventoryCount(userId: string, itemId: BlackMarketItemId): number {
  const row = db.prepare(`
    SELECT quantity FROM black_market_inventory WHERE user_id = ? AND item_key = ?
  `).get(String(userId), itemId) as { quantity?: number } | undefined;
  return Math.max(0, Math.floor(Number(row?.quantity) || 0));
}

/** Must be called inside the economy transaction when used by /roubar. */
export function consumeInventoryItem(userId: string, itemId: BlackMarketItemId): boolean {
  const result = db.prepare(`
    UPDATE black_market_inventory
    SET quantity = quantity - 1, updated_at = ?
    WHERE user_id = ? AND item_key = ? AND quantity > 0
  `).run(Date.now(), String(userId), itemId);
  return result.changes > 0;
}

export type MarketPurchaseResult =
  | { ok: true; balance: number }
  | { ok: false; reason: "item" | "balance" };

export function purchaseItem(user: User, itemId: string, guildId: string, guildName: string): MarketPurchaseResult {
  const item = BLACK_MARKET_ITEMS.find((entry) => entry.id === itemId);
  if (!item) return { ok: false, reason: "item" };

  const economy = require("./cookieEconomy") as { getProfile(user: User): { balance: number } };
  economy.getProfile(user);
  return db.transaction((): MarketPurchaseResult => {
    const debit = db.prepare(`
      UPDATE usuarios SET cookies = cookies - ?, cookies_lost = cookies_lost + ?,
        total_spent = total_spent + ?, updated_at = ?
      WHERE id = ? AND cookies >= ?
    `).run(item.price, item.price, item.price, Date.now(), user.id, item.price);
    if (debit.changes === 0) return { ok: false, reason: "balance" };

    db.prepare(`
      INSERT INTO black_market_inventory (user_id, item_key, quantity, updated_at)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(user_id, item_key) DO UPDATE SET
        quantity = black_market_inventory.quantity + 1,
        updated_at = excluded.updated_at
    `).run(user.id, item.id, Date.now());

    db.prepare(`
      INSERT INTO transacoes (tipo, user_id, amount, guild_id, guild_name, note, created_at)
      VALUES ('black_market_purchase', ?, ?, ?, ?, ?, ?)
    `).run(user.id, -item.price, guildId, guildName, item.name, Date.now());

    const balance = Number(db.prepare("SELECT cookies FROM usuarios WHERE id = ?").get(user.id)?.cookies) || 0;
    return { ok: true, balance };
  })();
}

export function recordRobberyJail(
  userId: string,
  guildId: string,
  now: number,
  attorneyUsed: boolean,
): PrisonStatus {
  const jail: PrisonStatus = {
    userId: String(userId),
    guildId: String(guildId),
    jailedAt: now,
    releaseAt: now + BLACK_MARKET_JAIL_MS,
    bailAmount: attorneyUsed ? Math.floor(BLACK_MARKET_BASE_BAIL / 2) : BLACK_MARKET_BASE_BAIL,
  };
  db.prepare(`
    INSERT INTO black_market_prison (user_id, guild_id, jailed_at, release_at, bail_amount, status, updated_at)
    VALUES (?, ?, ?, ?, ?, 'jailed', ?)
    ON CONFLICT(user_id) DO UPDATE SET
      guild_id = excluded.guild_id,
      jailed_at = excluded.jailed_at,
      release_at = excluded.release_at,
      bail_amount = excluded.bail_amount,
      status = 'jailed',
      updated_at = excluded.updated_at
  `).run(jail.userId, jail.guildId, jail.jailedAt, jail.releaseAt, jail.bailAmount, now);
  return jail;
}

export function getActivePrisonStatus(userId: string, now = Date.now()): PrisonStatus | null {
  const row = db.prepare(`
    SELECT user_id AS userId, guild_id AS guildId, jailed_at AS jailedAt,
      release_at AS releaseAt, bail_amount AS bailAmount
    FROM black_market_prison WHERE user_id = ? AND status = 'jailed'
  `).get(String(userId)) as PrisonStatus | undefined;
  if (!row) return null;
  if (row.releaseAt <= now) {
    db.prepare("UPDATE black_market_prison SET status = 'released', updated_at = ? WHERE user_id = ? AND status = 'jailed'")
      .run(now, String(userId));
    return null;
  }
  return row;
}

export type BailResult =
  | { ok: true; balance: number }
  | { ok: false; reason: "not_jailed" | "balance"; bailAmount?: number };

export function payBail(user: User): BailResult {
  const now = Date.now();
  const jail = getActivePrisonStatus(user.id, now);
  if (!jail) return { ok: false, reason: "not_jailed" };

  return db.transaction((): BailResult => {
    const current = db.prepare(`
      SELECT bail_amount AS bailAmount FROM black_market_prison
      WHERE user_id = ? AND status = 'jailed' AND release_at > ?
    `).get(user.id, now) as { bailAmount: number } | undefined;
    if (!current) return { ok: false, reason: "not_jailed" };
    const debit = db.prepare(`
      UPDATE usuarios SET cookies = cookies - ?, cookies_lost = cookies_lost + ?,
        total_spent = total_spent + ?, updated_at = ?
      WHERE id = ? AND cookies >= ?
    `).run(current.bailAmount, current.bailAmount, current.bailAmount, now, user.id, current.bailAmount);
    if (debit.changes === 0) return { ok: false, reason: "balance", bailAmount: current.bailAmount };

    db.prepare("UPDATE black_market_prison SET status = 'bailed', updated_at = ? WHERE user_id = ?")
      .run(now, user.id);
    db.prepare(`
      INSERT INTO transacoes (tipo, user_id, amount, guild_id, note, created_at)
      VALUES ('bail_paid', ?, ?, ?, ?, ?)
    `).run(user.id, -current.bailAmount, jail.guildId, "Fiança para sair da prisão do Mercado Negro", now);
    const balance = Number(db.prepare("SELECT cookies FROM usuarios WHERE id = ?").get(user.id)?.cookies) || 0;
    return { ok: true, balance };
  })();
}
