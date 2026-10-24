type SqlValue = string | number | null;
type DbRow = Record<string, unknown>;

interface DbStatement {
  get(...values: SqlValue[]): DbRow | undefined;
  all(...values: SqlValue[]): DbRow[];
  run(...values: SqlValue[]): { changes: number };
}

interface SyncDatabase {
  prepare(sql: string): DbStatement;
  transaction<T>(callback: () => T): () => T;
}

export interface GameContext {
  guildId?: string | null;
  guildName?: string | null;
}

export interface StakeRequest {
  userId: string;
  username: string;
  amount: number;
}

export type GameOutcome = "win" | "loss" | "draw";
export type GameResolution = GameOutcome | "refund";

export interface GameResultRequest {
  userId: string;
  username: string;
  outcome: GameResolution;
  /** Gross amount returned to the player. A win includes their returned stake. */
  payout?: number;
  note: string;
}

export interface StakeReservationResult {
  ok: boolean;
  reason?: "balance" | "invalid";
  userId?: string;
  balance?: number;
}

export interface GameBalanceResult {
  userId: string;
  balance: number;
  stake: number;
  payout: number;
  outcome: GameResolution;
}

const db = require("./db") as SyncDatabase;
const MAX_COOKIE_AMOUNT = 2_147_483_647;

function positiveInteger(value: number): number | null {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_COOKIE_AMOUNT) return null;
  return value;
}

function insertUserIfMissing(userId: string, username: string, now: number): void {
  db.prepare(`
    INSERT OR IGNORE INTO usuarios (id, username, cookies, last_tax_at, created_at, updated_at)
    VALUES (?, ?, 100, ?, ?, ?)
  `).run(userId, username, now, now, now);
}

function recordStats(userId: string, outcome: GameOutcome, now: number): void {
  const wins = outcome === "win" ? 1 : 0;
  const losses = outcome === "loss" ? 1 : 0;
  const draws = outcome === "draw" ? 1 : 0;

  db.prepare(`
    INSERT INTO stats_jogos (user_id, vitorias, derrotas, empates, partidas, updated_at)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      vitorias = stats_jogos.vitorias + excluded.vitorias,
      derrotas = stats_jogos.derrotas + excluded.derrotas,
      empates = stats_jogos.empates + excluded.empates,
      partidas = stats_jogos.partidas + 1,
      updated_at = excluded.updated_at
  `).run(userId, wins, losses, draws, now);

  db.prepare(`
    UPDATE usuarios
    SET games_played = games_played + 1,
        bet_wins = bet_wins + ?,
        bet_losses = bet_losses + ?,
        draws = draws + ?,
        updated_at = ?
    WHERE id = ?
  `).run(wins, losses, draws, now, userId);
}

function insertTransaction(
  type: string,
  userId: string,
  amount: number,
  context: GameContext,
  targetId: string | null,
  note: string,
  now: number,
): void {
  db.prepare(`
    INSERT INTO transacoes (tipo, user_id, amount, guild_id, guild_name, target_id, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    type,
    userId,
    amount,
    context.guildId ?? null,
    context.guildName ?? null,
    targetId,
    note.slice(0, 500),
    now,
  );
}

/** Atomically checks balances, debits each stake, and persists pending holds. */
export function reserveStakes(
  gameId: string,
  requests: readonly StakeRequest[],
  context: GameContext,
): StakeReservationResult {
  if (!gameId || requests.length === 0) return { ok: false, reason: "invalid" };
  const uniqueIds = new Set<string>();
  for (const request of requests) {
    if (!request.userId || uniqueIds.has(request.userId) || positiveInteger(request.amount) === null) {
      return { ok: false, reason: "invalid" };
    }
    uniqueIds.add(request.userId);
  }

  return db.transaction<StakeReservationResult>(() => {
    const now = Date.now();
    for (const request of requests) insertUserIfMissing(request.userId, request.username, now);

    for (const request of requests) {
      const alreadyHeld = db.prepare(
        "SELECT 1 AS found FROM game_bet_holds WHERE game_id = ? AND user_id = ?",
      ).get(gameId, request.userId);
      if (alreadyHeld) return { ok: false, reason: "invalid" };

      const balance = Number(db.prepare("SELECT cookies FROM usuarios WHERE id = ?")
        .get(request.userId)?.cookies ?? 0);
      if (balance < request.amount) {
        return { ok: false, reason: "balance", userId: request.userId, balance };
      }
    }

    for (const request of requests) {
      const changed = db.prepare(`
        UPDATE usuarios SET cookies = cookies - ?, updated_at = ?
        WHERE id = ? AND cookies >= ?
      `).run(request.amount, now, request.userId, request.amount);
      if (changed.changes !== 1) throw new Error("O saldo mudou durante a reserva da aposta.");

      db.prepare(`
        INSERT INTO game_bet_holds (game_id, user_id, stake, created_at)
        VALUES (?, ?, ?, ?)
      `).run(gameId, request.userId, request.amount, now);
      insertTransaction(
        "game_stake_reserved",
        request.userId,
        -request.amount,
        context,
        null,
        `Aposta reservada para ${gameId}`,
        now,
      );
    }

    return { ok: true };
  })();
}

/** Resolves every participant in one transaction; no partial duel payouts. */
export function resolveGame(
  gameId: string,
  results: readonly GameResultRequest[],
  context: GameContext,
): GameBalanceResult[] {
  if (!gameId || results.length === 0) throw new Error("Não há resultado para resolver.");
  const uniqueIds = new Set<string>();
  for (const result of results) {
    if (!result.userId || uniqueIds.has(result.userId)) throw new Error("Participante duplicado no resultado.");
    uniqueIds.add(result.userId);
    const payout = result.payout ?? 0;
    if (!Number.isSafeInteger(payout) || payout < 0 || payout > MAX_COOKIE_AMOUNT * 2) {
      throw new Error("Valor de prêmio inválido.");
    }
  }

  return db.transaction(() => {
    const now = Date.now();
    const resolved: GameBalanceResult[] = [];

    for (const result of results) {
      insertUserIfMissing(result.userId, result.username, now);
      const hold = db.prepare(`
        SELECT stake FROM game_bet_holds WHERE game_id = ? AND user_id = ?
      `).get(gameId, result.userId);
      const stake = Number(hold?.stake ?? 0);
      const payout = result.payout ?? (result.outcome === "draw" || result.outcome === "refund" ? stake : 0);

      if (!hold && payout > 0) throw new Error(`A aposta reservada de ${result.userId} não foi encontrada.`);
      if (result.outcome === "win" && stake > 0 && payout < stake) {
        throw new Error("O prêmio precisa devolver a aposta antes de registrar o lucro.");
      }
      if (result.outcome === "draw" && stake > 0 && payout !== stake) {
        throw new Error("Um empate deve devolver exatamente a aposta reservada.");
      }
      if (result.outcome === "refund" && stake > 0 && payout !== stake) {
        throw new Error("O estorno deve devolver exatamente a aposta reservada.");
      }

      const profit = result.outcome === "win" ? Math.max(0, payout - stake) : 0;
      const loss = result.outcome === "loss" ? stake : 0;
      const trackedOutcome = result.outcome === "refund" ? null : result.outcome;

      db.prepare(`
        UPDATE usuarios
        SET cookies = cookies + ?,
            cookies_won = cookies_won + ?,
            cookies_lost = cookies_lost + ?,
            total_earned = total_earned + ?,
            total_spent = total_spent + ?,
            biggest_win = MAX(biggest_win, ?),
            updated_at = ?
        WHERE id = ?
      `).run(payout, profit, loss, result.outcome === "win" ? payout : 0, loss, profit, now, result.userId);

      if (trackedOutcome) recordStats(result.userId, trackedOutcome, now);
      if (hold) {
        db.prepare("DELETE FROM game_bet_holds WHERE game_id = ? AND user_id = ?")
          .run(gameId, result.userId);
      }

      const transactionType = result.outcome === "refund"
        ? "game_refund"
        : result.outcome === "win"
          ? "game_win"
          : result.outcome === "loss"
            ? "game_loss"
            : "game_draw";
      insertTransaction(
        transactionType,
        result.userId,
        result.outcome === "refund" ? 0 : profit - loss,
        context,
        results.length > 1 ? results.find((other) => other.userId !== result.userId)?.userId ?? null : null,
        `${result.note} · aposta ${stake} · retorno ${payout}`,
        now,
      );

      const balance = Number(db.prepare("SELECT cookies FROM usuarios WHERE id = ?")
        .get(result.userId)?.cookies ?? 0);
      resolved.push({ userId: result.userId, balance, stake, payout, outcome: result.outcome });
    }

    return resolved;
  })();
}

/** Returns all unresolved stakes for a game, used for timeouts and failed replies. */
export function refundGameBets(gameId: string, context: GameContext = {}): GameBalanceResult[] {
  return db.transaction(() => {
    const now = Date.now();
    const holds = db.prepare(`
      SELECT user_id AS userId, stake FROM game_bet_holds WHERE game_id = ?
    `).all(gameId);
    const refunds: GameBalanceResult[] = [];

    for (const hold of holds) {
      const userId = String(hold.userId);
      const stake = Number(hold.stake);
      db.prepare("UPDATE usuarios SET cookies = cookies + ?, updated_at = ? WHERE id = ?")
        .run(stake, now, userId);
      db.prepare("DELETE FROM game_bet_holds WHERE game_id = ? AND user_id = ?")
        .run(gameId, userId);
      insertTransaction("game_refund", userId, stake, context, null, "Aposta devolvida; partida cancelada", now);
      refunds.push({
        userId,
        balance: Number(db.prepare("SELECT cookies FROM usuarios WHERE id = ?")
          .get(userId)?.cookies ?? 0),
        stake,
        payout: stake,
        outcome: "refund",
      });
    }

    return refunds;
  })();
}

/** A process restart ends all in-memory games, so return their persisted stakes. */
export function recoverPendingGameBets(): number {
  return db.transaction(() => {
    const now = Date.now();
    const holds = db.prepare("SELECT game_id AS gameId, user_id AS userId, stake FROM game_bet_holds").all();
    for (const hold of holds) {
      const userId = String(hold.userId);
      const stake = Number(hold.stake);
      db.prepare("UPDATE usuarios SET cookies = cookies + ?, updated_at = ? WHERE id = ?")
        .run(stake, now, userId);
      insertTransaction(
        "game_refund",
        userId,
        stake,
        {},
        null,
        `Aposta devolvida após reinicialização (${String(hold.gameId)})`,
        now,
      );
    }
    db.prepare("DELETE FROM game_bet_holds").run();
    return holds.length;
  })();
}
