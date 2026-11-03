import { randomInt, randomUUID } from "node:crypto";
import type { User } from "discord.js";
import type { SqliteDatabase } from "./sqliteTypes";
import { rollScratchCookieCount } from "./gameRules";

const db = require("./db") as SqliteDatabase;
const economy = require("./cookieEconomy") as {
  getProfile(user: User): { balance: number };
};
const logger = require("./logger") as {
  info(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: unknown, metadata?: Record<string, unknown>): void;
};

export const SCRATCH_TICKET_PRICE = 500;
export const SCRATCH_COOKIE_PRIZE = 10_000;
export const SCRATCH_GAME_TTL_MS = 15 * 60 * 1000;
const COOKIE_SYMBOL = "cookie";
// Tabela de frequência dos símbolos de preenchimento: os mais "raros" têm peso
// menor. Eles não alteram o RTP (só os cookies pagam), apenas a estética do cartão.
const FILLER_SYMBOL_WEIGHTS: readonly (readonly [string, number])[] = [
  ["ticket", 26],
  ["gift", 22],
  ["party", 18],
  ["palette", 15],
  ["trophy", 12],
  ["booster", 7],
];
const FILLER_TOTAL_WEIGHT = FILLER_SYMBOL_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);

function rollFillerSymbol(random: () => number = Math.random): string {
  let roll = random() * FILLER_TOTAL_WEIGHT;
  for (const [symbol, weight] of FILLER_SYMBOL_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return symbol;
  }
  return FILLER_SYMBOL_WEIGHTS[FILLER_SYMBOL_WEIGHTS.length - 1][0];
}

// Imagens Twemoji (PNG, CDN estável) para compor o cartão da raspadinha no canvas.
export const SCRATCH_SYMBOL_IMAGE_URLS: Readonly<Record<string, string>> = {
  cookie: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/1f36a.png",
  ticket: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/1f39f.png",
  trophy: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/1f3c6.png",
  gift: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/1f381.png",
  party: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/1f389.png",
  booster: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/1f680.png",
  palette: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/1f3a8.png",
};

export interface ScratchGame {
  id: string;
  guildId: string;
  userId: string;
  channelId: string;
  messageId: string | null;
  grid: string[];
  picks: number[];
  status: "pending" | "open" | "won" | "lost" | "refunded";
  price: number;
  prize: number;
  createdAt: number;
  expiresAt: number;
}

interface ScratchRow {
  id: string;
  guildId: string;
  userId: string;
  channelId: string;
  messageId: string | null;
  gridJson: string;
  picksJson: string;
  status: ScratchGame["status"];
  price: number;
  prize: number;
  createdAt: number;
  expiresAt: number;
}

function fromRow(row: ScratchRow | undefined): ScratchGame | null {
  if (!row) return null;
  return {
    id: row.id,
    guildId: row.guildId,
    userId: row.userId,
    channelId: row.channelId,
    messageId: row.messageId,
    grid: JSON.parse(row.gridJson) as string[],
    picks: JSON.parse(row.picksJson) as number[],
    status: row.status,
    price: row.price,
    prize: row.prize,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

function rollGrid(): string[] {
  // O número de cookies vem da tabela de frequência de gameRules (RTP 93%):
  // ~96,87% dos bilhetes têm 4 cookies (P = 4/84) e ~3,13% têm 3 (P = 1/84),
  // dando P(vitória) = 0,0465 e RTP = 0,0465 * (10.000/500) = 93%.
  const cookieCount = rollScratchCookieCount();
  const symbols: string[] = Array<string>(cookieCount).fill(COOKIE_SYMBOL);
  while (symbols.length < 9) symbols.push(rollFillerSymbol());
  for (let index = symbols.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [symbols[index], symbols[swapIndex]] = [symbols[swapIndex], symbols[index]];
  }
  return symbols;
}

export type StartScratchResult =
  | { ok: true; game: ScratchGame }
  | { ok: false; reason: "balance" | "active"; game?: ScratchGame };

export function startScratchGame(user: User, guildId: string, channelId: string): StartScratchResult {
  economy.getProfile(user);
  const active = db.prepare(`
    SELECT id, guild_id AS guildId, user_id AS userId, channel_id AS channelId,
      message_id AS messageId, grid_json AS gridJson, picks_json AS picksJson,
      status, price, prize, created_at AS createdAt, expires_at AS expiresAt
    FROM scratch_games WHERE guild_id = ? AND user_id = ? AND status IN ('pending', 'open')
    ORDER BY created_at DESC LIMIT 1
  `).get(String(guildId), user.id) as ScratchRow | undefined;
  if (active) return { ok: false, reason: "active", game: fromRow(active) ?? undefined };

  const now = Date.now();
  const gameId = randomUUID();
  const grid = rollGrid();
  return db.transaction((): StartScratchResult => {
    const debit = db.prepare(`
      UPDATE usuarios SET cookies = cookies - ?, cookies_lost = cookies_lost + ?,
        total_spent = total_spent + ?, updated_at = ?
      WHERE id = ? AND cookies >= ?
    `).run(SCRATCH_TICKET_PRICE, SCRATCH_TICKET_PRICE, SCRATCH_TICKET_PRICE, now, user.id, SCRATCH_TICKET_PRICE);
    if (debit.changes === 0) return { ok: false, reason: "balance" };

    db.prepare(`
      INSERT INTO scratch_games (id, guild_id, user_id, channel_id, grid_json, picks_json, status, price, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, '[]', 'pending', ?, ?, ?)
    `).run(gameId, String(guildId), user.id, String(channelId), JSON.stringify(grid), SCRATCH_TICKET_PRICE, now, now + SCRATCH_GAME_TTL_MS);
    db.prepare(`
      INSERT INTO transacoes (tipo, user_id, amount, guild_id, note, created_at)
      VALUES ('scratch_ticket', ?, ?, ?, ?, ?)
    `).run(user.id, -SCRATCH_TICKET_PRICE, String(guildId), `Bilhete de raspadinha ${gameId}`, now);

    const row = db.prepare(`
      SELECT id, guild_id AS guildId, user_id AS userId, channel_id AS channelId,
        message_id AS messageId, grid_json AS gridJson, picks_json AS picksJson,
        status, price, prize, created_at AS createdAt, expires_at AS expiresAt
      FROM scratch_games WHERE id = ?
    `).get(gameId) as ScratchRow;
    return { ok: true, game: fromRow(row)! };
  })();
}

export function getScratchGame(gameId: string): ScratchGame | null {
  const row = db.prepare(`
    SELECT id, guild_id AS guildId, user_id AS userId, channel_id AS channelId,
      message_id AS messageId, grid_json AS gridJson, picks_json AS picksJson,
      status, price, prize, created_at AS createdAt, expires_at AS expiresAt
    FROM scratch_games WHERE id = ?
  `).get(gameId) as ScratchRow | undefined;
  return fromRow(row);
}

export function attachScratchMessage(gameId: string, messageId: string): void {
  db.prepare(`
    UPDATE scratch_games SET message_id = ?
    WHERE id = ? AND status = 'open'
  `).run(String(messageId), String(gameId));
}

export function activateScratchGame(gameId: string): void {
  const result = db.prepare("UPDATE scratch_games SET status = 'open' WHERE id = ? AND status = 'pending'")
    .run(String(gameId));
  if (result.changes === 0) throw new Error("A raspadinha não está mais pendente.");
}

export function cancelPendingScratchGame(gameId: string): boolean {
  return db.transaction(() => refundGame(gameId, Date.now()))();
}

function refundGame(gameId: string, now: number, pendingOnly = false): boolean {
  const statusFilter = pendingOnly ? "AND status = 'pending'" : "AND status IN ('pending', 'open')";
  const row = db.prepare(`
    SELECT user_id AS userId, guild_id AS guildId, price FROM scratch_games
    WHERE id = ? ${statusFilter}
  `).get(String(gameId)) as { userId: string; guildId: string; price: number } | undefined;
  if (!row) return false;

  const updated = db.prepare(`
    UPDATE scratch_games SET status = 'refunded', finished_at = ?
    WHERE id = ? ${statusFilter}
  `).run(now, String(gameId));
  if (updated.changes === 0) return false;
  db.prepare(`
    UPDATE usuarios SET cookies = cookies + ?, cookies_lost = MAX(0, cookies_lost - ?),
      total_spent = MAX(0, total_spent - ?), updated_at = ? WHERE id = ?
  `).run(row.price, row.price, row.price, now, row.userId);
  db.prepare(`
    INSERT INTO transacoes (tipo, user_id, amount, guild_id, note, created_at)
    VALUES ('scratch_refund', ?, ?, ?, ?, ?)
  `).run(row.userId, row.price, row.guildId, "Bilhete devolvido após expiração da raspadinha", now);
  return true;
}

export type ScratchPickResult =
  | { ok: true; game: ScratchGame; completed: boolean; won: boolean }
  | { ok: false; reason: "missing" | "owner" | "finished" | "expired" | "invalid_cell"; game: ScratchGame | null };

export function selectScratchCell(gameId: string, userId: string, cell: number, now = Date.now()): ScratchPickResult {
  return db.transaction((): ScratchPickResult => {
    const row = db.prepare(`
      SELECT id, guild_id AS guildId, user_id AS userId, channel_id AS channelId,
        message_id AS messageId, grid_json AS gridJson, picks_json AS picksJson,
        status, price, prize, created_at AS createdAt, expires_at AS expiresAt
      FROM scratch_games WHERE id = ?
    `).get(String(gameId)) as ScratchRow | undefined;
    const game = fromRow(row);
    if (!game) return { ok: false, reason: "missing", game: null };
    if (game.userId !== String(userId)) return { ok: false, reason: "owner", game };
    if (game.status !== "open") return { ok: false, reason: "finished", game };
    if (game.expiresAt <= now) {
      refundGame(game.id, now);
      return { ok: false, reason: "expired", game: { ...game, status: "refunded" } };
    }
    if (!Number.isInteger(cell) || cell < 0 || cell >= game.grid.length || game.picks.includes(cell) || game.picks.length >= 3) {
      return { ok: false, reason: "invalid_cell", game };
    }

    const picks = [...game.picks, cell];
    const completed = picks.length === 3;
    const won = completed && picks.every((index) => game.grid[index] === COOKIE_SYMBOL);
    const status: ScratchGame["status"] = completed ? (won ? "won" : "lost") : "open";
    const prize = won ? SCRATCH_COOKIE_PRIZE : 0;
    db.prepare(`
      UPDATE scratch_games SET picks_json = ?, status = ?, prize = ?, finished_at = ?
      WHERE id = ? AND status = 'open'
    `).run(JSON.stringify(picks), status, prize, completed ? now : null, game.id);

    if (won) {
      db.prepare(`
        UPDATE usuarios SET cookies = cookies + ?, cookies_won = cookies_won + ?,
          total_earned = total_earned + ?, updated_at = ? WHERE id = ?
      `).run(prize, prize, prize, now, game.userId);
      db.prepare(`
        INSERT INTO transacoes (tipo, user_id, amount, guild_id, note, created_at)
        VALUES ('scratch_win', ?, ?, ?, ?, ?)
      `).run(game.userId, prize, game.guildId, `Prêmio da raspadinha ${game.id}`, now);
    }

    const updatedGame: ScratchGame = { ...game, picks, status, prize };
    return { ok: true, game: updatedGame, completed, won };
  })();
}

export function refundExpiredScratchGames(now = Date.now()): number {
  return db.transaction(() => {
    const expired = db.prepare(`
      SELECT id FROM scratch_games
      WHERE (status = 'pending' AND created_at <= ?) OR (status = 'open' AND expires_at <= ?)
    `).all(now - 2 * 60 * 1000, now) as Array<{ id: string }>;
    let refunded = 0;
    for (const row of expired) if (refundGame(row.id, now)) refunded += 1;
    return refunded;
  })();
}

let cleanupStarted = false;
export function startScratchCleanupScheduler(): void {
  if (cleanupStarted) return;
  cleanupStarted = true;
  try {
    const count = refundExpiredScratchGames();
    if (count > 0) logger.info("Bilhetes de raspadinha expirados devolvidos", { count });
  } catch (error) {
    logger.error("Falha ao recuperar raspadinhas expiradas", error);
  }
  const timer = setInterval(() => {
    try {
      const count = refundExpiredScratchGames();
      if (count > 0) logger.info("Bilhetes de raspadinha expirados devolvidos", { count });
    } catch (error) {
      logger.error("Falha ao recuperar raspadinhas expiradas", error);
    }
  }, 60_000);
  timer.unref?.();
}
