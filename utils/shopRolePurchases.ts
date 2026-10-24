import { randomUUID } from "node:crypto";
import type { Client, Guild, GuildMember, Role } from "discord.js";

type SqliteValue = string | number | null;

interface SqliteStatement {
  get<T = unknown>(...parameters: SqliteValue[]): T | undefined;
  all<T = unknown>(...parameters: SqliteValue[]): T[];
  run(...parameters: SqliteValue[]): { changes: number; lastInsertRowid: number | bigint };
}

interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  transaction<T>(callback: () => T): () => T;
}

export type ShopRoleKind = "color" | "vip";

export interface ShopRoleOffer {
  guildId: string;
  roleId: string;
  name: string;
  mention: string;
  kind: ShopRoleKind;
  price: number;
  benefitPercent: number;
  duration: number | null;
  role: Role;
}

export interface PurchaseDetails {
  guildId: string;
  guildName: string;
}

export interface RolePurchaseReservation {
  id: string;
  userId: string;
  guildId: string;
  guildName: string;
  roleId: string;
  roleName: string;
  kind: ShopRoleKind;
  price: number;
  benefitPercent: number;
  expiresAt: number | null;
  transactionId: number;
  createdAt: number;
}

export type ReserveRolePurchaseResult =
  | { ok: true; reservation: RolePurchaseReservation }
  | { ok: false; reason: "invalid_offer" | "busy" | "balance" | "owned" };

const db = require("./db") as SqliteDatabase;
const { PRIMARY_GUILD_ID } = require("./primaryGuild") as typeof import("./primaryGuild");
const logger = require("./logger") as {
  error(message: string, error?: unknown, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
};

const RECOVERY_DELAY_MS = 5 * 60 * 1000;
const RECOVERY_INTERVAL_MS = 60 * 1000;
let recoveryStarted = false;
let recoveryRunning = false;

function readReservation(reservationId: string): RolePurchaseReservation | null {
  return db.prepare(`
    SELECT id, user_id AS userId, guild_id AS guildId, guild_name AS guildName,
      role_id AS roleId, role_name AS roleName, kind, price, benefit_percent AS benefitPercent,
      expires_at AS expiresAt,
      transaction_id AS transactionId, created_at AS createdAt
    FROM shop_role_purchase_reservations WHERE id = ?
  `).get<RolePurchaseReservation>(reservationId) ?? null;
}

/** Debita e registra uma compra pendente na mesma transação SQLite. */
export function reserveRolePurchase(
  user: { id: string; username: string },
  offer: ShopRoleOffer,
  details: PurchaseDetails,
): ReserveRolePurchaseResult {
  if (
    !offer.guildId || !offer.roleId || !offer.name ||
    !["color", "vip"].includes(offer.kind) ||
    !Number.isSafeInteger(offer.price) || offer.price <= 0 ||
    !Number.isSafeInteger(offer.benefitPercent) || offer.benefitPercent < 0 || offer.benefitPercent > 100 ||
    (offer.kind === "vip" && (!offer.duration || offer.duration <= 0))
  ) return { ok: false, reason: "invalid_offer" };

  return db.transaction<ReserveRolePurchaseResult>(() => {
    const pending = db.prepare("SELECT id FROM shop_role_purchase_reservations WHERE user_id = ?")
      .get<{ id: string }>(user.id);
    if (pending) return { ok: false, reason: "busy" };

    const account = db.prepare("SELECT cookies FROM usuarios WHERE id = ?")
      .get<{ cookies: number }>(user.id);
    if (!account || account.cookies < offer.price) return { ok: false, reason: "balance" };

    const existing = db.prepare(`
      SELECT expires_at AS expiresAt FROM guild_shop_role_purchases
      WHERE guild_id = ? AND user_id = ? AND role_id = ? AND kind = ?
    `).get<{ expiresAt: number | null }>(offer.guildId, user.id, offer.roleId, offer.kind);
    if (offer.kind === "color" && existing) return { ok: false, reason: "owned" };

    const now = Date.now();
    const expiresAt = offer.kind === "vip"
      ? Math.max(now, Number(existing?.expiresAt) || 0) + offer.duration!
      : null;
    const debit = db.prepare(`
      UPDATE usuarios
      SET cookies = cookies - ?, cookies_lost = cookies_lost + ?,
        total_spent = total_spent + ?, updated_at = ?
      WHERE id = ? AND cookies >= ?
    `).run(offer.price, offer.price, offer.price, now, user.id, offer.price);
    if (debit.changes !== 1) return { ok: false, reason: "balance" };

    const note = `${offer.kind === "vip" ? "VIP" : "Cor"} ${offer.name}`;
    const transaction = db.prepare(`
      INSERT INTO transacoes (tipo, user_id, amount, guild_id, guild_name, note, created_at)
      VALUES ('shop_server_role_purchase_pending', ?, ?, ?, ?, ?, ?)
    `).run(user.id, -offer.price, details.guildId, details.guildName, note, now);
    const reservation: RolePurchaseReservation = {
      id: randomUUID(),
      userId: user.id,
      guildId: details.guildId,
      guildName: details.guildName,
      roleId: offer.roleId,
      roleName: offer.name,
      kind: offer.kind,
      price: offer.price,
      benefitPercent: offer.benefitPercent,
      expiresAt,
      transactionId: Number(transaction.lastInsertRowid),
      createdAt: now,
    };
    db.prepare(`
      INSERT INTO shop_role_purchase_reservations
        (id, user_id, guild_id, guild_name, role_id, role_name, kind, price, benefit_percent, expires_at, transaction_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reservation.id,
      reservation.userId,
      reservation.guildId,
      reservation.guildName,
      reservation.roleId,
      reservation.roleName,
      reservation.kind,
      reservation.price,
      reservation.benefitPercent,
      reservation.expiresAt,
      reservation.transactionId,
      reservation.createdAt,
    );

    return { ok: true, reservation };
  })();
}

/** Finaliza o registro do cargo somente depois da confirmação do Discord. */
export function completeRolePurchase(reservationId: string): RolePurchaseReservation | null {
  return db.transaction(() => {
    const reservation = readReservation(reservationId);
    if (!reservation) return null;

    db.prepare(`
      INSERT INTO guild_shop_role_purchases
        (guild_id, user_id, role_id, kind, price, benefit_percent, purchased_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id, role_id, kind) DO UPDATE SET
        price = excluded.price, benefit_percent = excluded.benefit_percent,
        purchased_at = excluded.purchased_at, expires_at = excluded.expires_at
    `).run(
      reservation.guildId,
      reservation.userId,
      reservation.roleId,
      reservation.kind,
      reservation.price,
      reservation.benefitPercent,
      reservation.createdAt,
      reservation.expiresAt,
    );
    db.prepare(`
      UPDATE transacoes SET tipo = 'shop_server_role_purchase'
      WHERE id = ? AND tipo = 'shop_server_role_purchase_pending'
    `).run(reservation.transactionId);
    db.prepare("DELETE FROM shop_role_purchase_reservations WHERE id = ?")
      .run(reservation.id);
    return reservation;
  })();
}

/** Reverte o débito uma única vez e deixa o estorno visível no histórico. */
export function refundRolePurchase(reservationId: string, reason: string): boolean {
  return db.transaction(() => {
    const reservation = readReservation(reservationId);
    if (!reservation) return false;

    const credited = db.prepare(`
      UPDATE usuarios
      SET cookies = cookies + ?,
        cookies_lost = MAX(0, cookies_lost - ?),
        total_spent = MAX(0, total_spent - ?), updated_at = ?
      WHERE id = ?
    `).run(reservation.price, reservation.price, reservation.price, Date.now(), reservation.userId);
    if (credited.changes !== 1) throw new Error("A conta da compra pendente não existe para estorno.");

    db.prepare(`
      UPDATE transacoes
      SET tipo = 'shop_server_role_refund', amount = ?, note = ?
      WHERE id = ? AND tipo = 'shop_server_role_purchase_pending'
    `).run(
      reservation.price,
      `${reservation.kind === "vip" ? "VIP" : "Cor"} ${reservation.roleName} · ${reason}`.slice(0, 500),
      reservation.transactionId,
    );
    db.prepare("DELETE FROM shop_role_purchase_reservations WHERE id = ?")
      .run(reservation.id);
    return true;
  })();
}

function unknownDiscordResource(error: unknown, code: number): boolean {
  return typeof error === "object" && error !== null && "code" in error && Number(error.code) === code;
}

async function recoverReservation(client: Client, reservation: RolePurchaseReservation): Promise<void> {
  if (reservation.guildId !== PRIMARY_GUILD_ID) {
    refundRolePurchase(reservation.id, "servidor não é o servidor exclusivo do Rascal");
    return;
  }
  let guild: Guild;
  try {
    guild = client.guilds.cache.get(reservation.guildId) ?? await client.guilds.fetch(reservation.guildId);
  } catch (error) {
    if (unknownDiscordResource(error, 10004)) {
      refundRolePurchase(reservation.id, "servidor indisponível durante a recuperação");
      return;
    }
    throw error;
  }

  let role: Role | null;
  try {
    role = guild.roles.cache.get(reservation.roleId) ?? await guild.roles.fetch(reservation.roleId);
  } catch (error) {
    if (unknownDiscordResource(error, 10011)) {
      refundRolePurchase(reservation.id, "cargo removido durante a recuperação");
      return;
    }
    throw error;
  }
  if (!role) {
    refundRolePurchase(reservation.id, "cargo removido durante a recuperação");
    return;
  }

  let member: GuildMember;
  try {
    member = guild.members.cache.get(reservation.userId) ?? await guild.members.fetch(reservation.userId);
  } catch (error) {
    if (unknownDiscordResource(error, 10007)) {
      refundRolePurchase(reservation.id, "usuário não está mais no servidor");
      return;
    }
    throw error;
  }

  if (member.roles.cache.has(role.id)) {
    completeRolePurchase(reservation.id);
  } else {
    refundRolePurchase(reservation.id, "o cargo não foi aplicado pelo Discord");
  }
}

/** Recupera transações antigas após reinício sem interferir numa chamada REST ativa. */
export function startRolePurchaseRecovery(client: Client): void {
  if (recoveryStarted) return;
  recoveryStarted = true;

  const recover = async (): Promise<void> => {
    if (recoveryRunning) return;
    recoveryRunning = true;
    try {
      const cutoff = Date.now() - RECOVERY_DELAY_MS;
      const pending = db.prepare(`
        SELECT id, user_id AS userId, guild_id AS guildId, guild_name AS guildName,
          role_id AS roleId, role_name AS roleName, kind, price, benefit_percent AS benefitPercent,
          expires_at AS expiresAt,
          transaction_id AS transactionId, created_at AS createdAt
        FROM shop_role_purchase_reservations WHERE guild_id = ? AND created_at <= ? ORDER BY created_at LIMIT 25
      `).all<RolePurchaseReservation>(PRIMARY_GUILD_ID, cutoff);
      for (const reservation of pending) {
        try {
          await recoverReservation(client, reservation);
        } catch (error) {
          logger.warn("Compra de cargo pendente será reavaliada", {
            reservationId: reservation.id,
            userId: reservation.userId,
            guildId: reservation.guildId,
            code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
          });
        }
      }
    } catch (error) {
      logger.error("Falha ao recuperar compras pendentes da loja", error);
    } finally {
      recoveryRunning = false;
    }
  };

  void recover();
  const timer = setInterval(() => void recover(), RECOVERY_INTERVAL_MS);
  timer.unref?.();
}
