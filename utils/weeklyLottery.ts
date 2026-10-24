import { randomInt } from "node:crypto";
import type { Client, TextChannel, User } from "discord.js";
import type { SqliteDatabase } from "./sqliteTypes";
const { EmbedBuilder } = require("discord.js") as typeof import("discord.js");

const db = require("./db") as SqliteDatabase;
const economy = require("./cookieEconomy") as {
  getProfile(user: User): { balance: number };
};
const { randomColor } = require("./embedStyle") as { randomColor(): number };
const emoji = require("./emojis") as typeof import("./emojis");
const logger = require("./logger") as {
  error(message: string, error?: unknown, metadata?: Record<string, unknown>): void;
};

export const LOTTERY_TICKET_PRICE = 500;
export const LOTTERY_POT_PERCENT = 50;
const LOTTERY_TIME_ZONE = "America/Sao_Paulo";
const DRAW_HOUR = 20;

interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

interface LotteryPool {
  guildId: string;
  drawKey: string;
  drawAt: number;
  potCookies: number;
  ticketCount: number;
}

interface DrawResult extends LotteryPool {
  winnerId: string;
  ticketId: number;
  drawnAt: number;
}

function localParts(timestamp: number): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LOTTERY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour: Number(value.hour),
    minute: Number(value.minute),
    second: Number(value.second),
  };
}

function localTimeToUtc(year: number, month: number, day: number, hour: number): number {
  const utcGuess = Date.UTC(year, month - 1, day, hour);
  const represented = localParts(utcGuess);
  const representedAsUtc = Date.UTC(
    represented.year,
    represented.month - 1,
    represented.day,
    represented.hour,
    represented.minute,
    represented.second,
  );
  return utcGuess - (representedAsUtc - utcGuess);
}

function keyFor(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function nextLotteryDraw(now = Date.now()): { drawAt: number; drawKey: string } {
  const local = localParts(now);
  const weekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
  let daysUntilSunday = (7 - weekday) % 7;
  let targetDate = new Date(Date.UTC(local.year, local.month - 1, local.day + daysUntilSunday));
  let drawAt = localTimeToUtc(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, targetDate.getUTCDate(), DRAW_HOUR);

  if (drawAt <= now) {
    targetDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate() + 7));
    drawAt = localTimeToUtc(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, targetDate.getUTCDate(), DRAW_HOUR);
  }

  return {
    drawAt,
    drawKey: keyFor(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, targetDate.getUTCDate()),
  };
}

export function setAnnouncementChannel(guildId: string, channelId: string, userId: string): void {
  db.prepare(`
    INSERT INTO weekly_lottery_settings (guild_id, announcement_channel_id, updated_by, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      announcement_channel_id = excluded.announcement_channel_id,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).run(String(guildId), String(channelId), String(userId), Date.now());
}

export function getAnnouncementChannel(guildId: string): string | null {
  const row = db.prepare("SELECT announcement_channel_id AS channelId FROM weekly_lottery_settings WHERE guild_id = ?")
    .get(String(guildId)) as { channelId?: string | null } | undefined;
  return row?.channelId || null;
}

export type TicketPurchaseResult =
  | { ok: true; count: number; spent: number; contribution: number; balance: number; drawAt: number; drawKey: string; ticketIds: number[] }
  | { ok: false; reason: "invalid_count" | "balance" | "channel" };

export function buyTickets(
  user: User,
  guildId: string,
  guildName: string,
  count: number,
): TicketPurchaseResult {
  if (!Number.isInteger(count) || count < 1 || count > 50) return { ok: false, reason: "invalid_count" };
  if (!getAnnouncementChannel(guildId)) return { ok: false, reason: "channel" };
  economy.getProfile(user);

  const draw = nextLotteryDraw();
  const spent = LOTTERY_TICKET_PRICE * count;
  const contribution = Math.floor(LOTTERY_TICKET_PRICE * LOTTERY_POT_PERCENT / 100) * count;
  return db.transaction((): TicketPurchaseResult => {
    const debit = db.prepare(`
      UPDATE usuarios SET cookies = cookies - ?, cookies_lost = cookies_lost + ?,
        total_spent = total_spent + ?, updated_at = ?
      WHERE id = ? AND cookies >= ?
    `).run(spent, spent, spent, Date.now(), user.id, spent);
    if (debit.changes === 0) return { ok: false, reason: "balance" };

    db.prepare(`
      INSERT OR IGNORE INTO weekly_lottery_pools (guild_id, draw_key, draw_at, created_at)
      VALUES (?, ?, ?, ?)
    `).run(String(guildId), draw.drawKey, draw.drawAt, Date.now());
    const pool = db.prepare(`
      SELECT status FROM weekly_lottery_pools WHERE guild_id = ? AND draw_key = ?
    `).get(String(guildId), draw.drawKey) as { status?: string } | undefined;
    if (!pool || pool.status !== "open") throw new Error("O pote desta semana não está aberto.");

    const insertTicket = db.prepare(`
      INSERT INTO weekly_lottery_tickets (guild_id, draw_key, user_id, purchased_at, price)
      VALUES (?, ?, ?, ?, ?)
    `);
    const ticketIds: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const ticket = insertTicket.run(String(guildId), draw.drawKey, user.id, Date.now(), LOTTERY_TICKET_PRICE);
      ticketIds.push(Number(ticket.lastInsertRowid));
    }
    db.prepare(`
      UPDATE weekly_lottery_pools SET pot_cookies = pot_cookies + ?, ticket_count = ticket_count + ?
      WHERE guild_id = ? AND draw_key = ? AND status = 'open'
    `).run(contribution, count, String(guildId), draw.drawKey);
    db.prepare(`
      INSERT INTO transacoes (tipo, user_id, amount, guild_id, guild_name, note, created_at)
      VALUES ('lottery_ticket', ?, ?, ?, ?, ?, ?)
    `).run(user.id, -spent, String(guildId), guildName, `${count} bilhete(s) para ${draw.drawKey}`, Date.now());

    const balance = Number(db.prepare("SELECT cookies FROM usuarios WHERE id = ?").get(user.id)?.cookies) || 0;
    return { ok: true, count, spent, contribution, balance, ...draw, ticketIds };
  })();
}

export function getLotteryStatus(guildId: string, userId: string): {
  drawAt: number;
  drawKey: string;
  potCookies: number;
  ticketCount: number;
  userTickets: number;
  channelId: string | null;
} {
  const draw = nextLotteryDraw();
  const pool = db.prepare(`
    SELECT pot_cookies AS potCookies, ticket_count AS ticketCount
    FROM weekly_lottery_pools WHERE guild_id = ? AND draw_key = ?
  `).get(String(guildId), draw.drawKey) as { potCookies?: number; ticketCount?: number } | undefined;
  const userTickets = Number(db.prepare(`
    SELECT COUNT(*) AS count FROM weekly_lottery_tickets
    WHERE guild_id = ? AND draw_key = ? AND user_id = ?
  `).get(String(guildId), draw.drawKey, String(userId))?.count) || 0;

  return {
    ...draw,
    potCookies: Number(pool?.potCookies) || 0,
    ticketCount: Number(pool?.ticketCount) || 0,
    userTickets,
    channelId: getAnnouncementChannel(guildId),
  };
}

function drawOnePool(pool: LotteryPool): DrawResult | null {
  return db.transaction((): DrawResult | null => {
    const current = db.prepare(`
      SELECT pot_cookies AS potCookies, ticket_count AS ticketCount, status
      FROM weekly_lottery_pools WHERE guild_id = ? AND draw_key = ? AND draw_at <= ?
    `).get(pool.guildId, pool.drawKey, Date.now()) as (LotteryPool & { status: string }) | undefined;
    if (!current || current.status !== "open") return null;
    if (current.ticketCount <= 0 || current.potCookies <= 0) {
      db.prepare("UPDATE weekly_lottery_pools SET status = 'empty', drawn_at = ? WHERE guild_id = ? AND draw_key = ? AND status = 'open'")
        .run(Date.now(), pool.guildId, pool.drawKey);
      return null;
    }

    const offset = randomInt(0, current.ticketCount);
    const ticket = db.prepare(`
      SELECT id, user_id AS userId FROM weekly_lottery_tickets
      WHERE guild_id = ? AND draw_key = ? ORDER BY id LIMIT 1 OFFSET ?
    `).get(pool.guildId, pool.drawKey, offset) as { id: number; userId: string } | undefined;
    if (!ticket) throw new Error(`Bilhete sorteado não foi encontrado: ${pool.drawKey}`);

    const now = Date.now();
    db.prepare(`
      UPDATE usuarios SET cookies = cookies + ?, cookies_won = cookies_won + ?,
        total_earned = total_earned + ?, updated_at = ? WHERE id = ?
    `).run(current.potCookies, current.potCookies, current.potCookies, now, ticket.userId);
    db.prepare(`
      INSERT INTO transacoes (tipo, user_id, amount, guild_id, note, created_at)
      VALUES ('lottery_win', ?, ?, ?, ?, ?)
    `).run(ticket.userId, current.potCookies, pool.guildId, `Loteria semanal ${pool.drawKey}`, now);
    db.prepare("UPDATE weekly_lottery_pools SET status = 'drawn', drawn_at = ? WHERE guild_id = ? AND draw_key = ? AND status = 'open'")
      .run(now, pool.guildId, pool.drawKey);
    db.prepare(`
      INSERT INTO weekly_lottery_draws (guild_id, draw_key, winner_user_id, winning_ticket_id, pot_cookies, ticket_count, drawn_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(pool.guildId, pool.drawKey, ticket.userId, ticket.id, current.potCookies, current.ticketCount, now);

    return {
      guildId: pool.guildId,
      drawKey: pool.drawKey,
      drawAt: pool.drawAt,
      potCookies: current.potCookies,
      ticketCount: current.ticketCount,
      winnerId: ticket.userId,
      ticketId: ticket.id,
      drawnAt: now,
    };
  })();
}

async function announceDraw(client: Client, result: DrawResult): Promise<void> {
  const channelId = getAnnouncementChannel(result.guildId);
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased() || !channel.isSendable()) throw new Error("O canal configurado não aceita mensagens.");
    const textChannel = channel as TextChannel;
    await textChannel.send({
      embeds: [new EmbedBuilder()
        .setColor(randomColor())
        .setTitle(`${emoji.application("trophy", "🏆")} Loteria semanal · resultado`)
        .setDescription([
          `O bilhete **#${result.ticketId}** foi sorteado! Parabéns, <@${result.winnerId}>.`,
          `${emoji.application("cookie", "🍪")} Prêmio acumulado: **${result.potCookies.toLocaleString("pt-BR")} cookies**.`,
          `Bilhetes vendidos: **${result.ticketCount.toLocaleString("pt-BR")}**.`,
        ].join("\n"))
        .setFooter({ text: `Sorteio de domingo · ${result.drawKey}` })],
      allowedMentions: { users: [result.winnerId] },
    });
    db.prepare("UPDATE weekly_lottery_draws SET announced_at = ?, announcement_error = NULL WHERE guild_id = ? AND draw_key = ?")
      .run(Date.now(), result.guildId, result.drawKey);
  } catch (error) {
    logger.error("Falha ao anunciar resultado da loteria", error, { guildId: result.guildId, drawKey: result.drawKey });
    db.prepare("UPDATE weekly_lottery_draws SET announcement_error = ? WHERE guild_id = ? AND draw_key = ?")
      .run(String(error).slice(0, 500), result.guildId, result.drawKey);
  }
}

let schedulerStarted = false;
let drawInProgress = false;

export async function runLotteryDraws(client: Client): Promise<void> {
  if (drawInProgress) return;
  drawInProgress = true;
  try {
    const due = db.prepare(`
      SELECT guild_id AS guildId, draw_key AS drawKey, draw_at AS drawAt,
        pot_cookies AS potCookies, ticket_count AS ticketCount
      FROM weekly_lottery_pools WHERE status = 'open' AND draw_at <= ? ORDER BY draw_at LIMIT 25
    `).all(Date.now()) as LotteryPool[];
    for (const pool of due) {
      const result = drawOnePool(pool);
      if (result) await announceDraw(client, result);
    }

    const pending = db.prepare(`
      SELECT guild_id AS guildId, draw_key AS drawKey, winner_user_id AS winnerId,
        winning_ticket_id AS ticketId, pot_cookies AS potCookies, ticket_count AS ticketCount, drawn_at AS drawnAt
      FROM weekly_lottery_draws WHERE announced_at IS NULL ORDER BY drawn_at LIMIT 25
    `).all() as Array<DrawResult>;
    for (const result of pending) await announceDraw(client, result);
  } finally {
    drawInProgress = false;
  }
}

export function startWeeklyLotteryScheduler(client: Client): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  void runLotteryDraws(client).catch((error: unknown) => logger.error("Falha ao executar sorteio semanal", error));
  const timer = setInterval(() => {
    void runLotteryDraws(client).catch((error: unknown) => logger.error("Falha ao executar sorteio semanal", error));
  }, 60_000);
  timer.unref?.();
}
