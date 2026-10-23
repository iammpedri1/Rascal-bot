import type { Client, User } from "discord.js";

const { EmbedBuilder } = require("discord.js");
const db = require("./db");
const emoji = require("./emojis");
const logger = require("./logger");

export interface BirthdayRecord {
  guildId: string;
  userId: string;
  channelId: string;
  day: number;
  month: number;
  lastSentYear: number | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface BirthdayInput {
  guildId: string;
  userId: string;
  channelId: string;
  day: number;
  month: number;
}

interface BirthdayDateParts {
  day: number;
  month: number;
  year: number;
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

let schedulerStarted = false;
let birthdayRunning = false;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function nowParts(date = new Date()): BirthdayDateParts {
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

export function monthName(month: number): string {
  return MONTHS[month - 1] || "mês inválido";
}

function maxDayForMonth(month: number): number {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 0;
}

export function isValidBirthday(day: number | null, month: number | null): boolean {
  if (typeof day !== "number" || typeof month !== "number") return false;
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= maxDayForMonth(month);
}

export function formatBirthday(day: number, month: number): string {
  return `${String(day).padStart(2, "0")} de ${monthName(month)}`;
}

export function setBirthday(input: BirthdayInput): BirthdayRecord | undefined {
  const { guildId, userId, channelId, day, month } = input;
  if (!guildId || !userId || !channelId || !isValidBirthday(day, month)) {
    throw new TypeError("Dados de aniversário inválidos");
  }

  const createdAt = Date.now();
  db.prepare(`
    INSERT INTO birthdays (guild_id, user_id, channel_id, day, month, last_sent_year, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(guild_id, user_id)
    DO UPDATE SET
      channel_id = excluded.channel_id,
      day = excluded.day,
      month = excluded.month,
      updated_at = excluded.updated_at
  `).run(String(guildId), String(userId), String(channelId), day, month, createdAt, createdAt);

  return getBirthday(guildId, userId);
}

export function getBirthday(guildId: string, userId: string): BirthdayRecord | undefined {
  return db.prepare(`
    SELECT
      guild_id AS guildId,
      user_id AS userId,
      channel_id AS channelId,
      day,
      month,
      last_sent_year AS lastSentYear,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM birthdays
    WHERE guild_id = ? AND user_id = ?
  `).get(String(guildId), String(userId)) as BirthdayRecord | undefined;
}

export function removeBirthday(guildId: string, userId: string): boolean {
  const result = db.prepare("DELETE FROM birthdays WHERE guild_id = ? AND user_id = ?")
    .run(String(guildId), String(userId));
  return result.changes > 0;
}

function dueBirthdays(date = new Date()): BirthdayRecord[] {
  const { day, month, year } = nowParts(date);
  return db.prepare(`
    SELECT
      guild_id AS guildId,
      user_id AS userId,
      channel_id AS channelId,
      day,
      month,
      last_sent_year AS lastSentYear
    FROM birthdays
    WHERE day = ? AND month = ? AND COALESCE(last_sent_year, 0) != ?
  `).all(day, month, year) as BirthdayRecord[];
}

function markBirthdaySent(guildId: string, userId: string, year: number): void {
  db.prepare(`
    UPDATE birthdays
    SET last_sent_year = ?, updated_at = ?
    WHERE guild_id = ? AND user_id = ?
  `).run(year, Date.now(), String(guildId), String(userId));
}

function buildBirthdayEmbed(user: User) {
  return new EmbedBuilder()
    .setColor(0xff9ac7)
    .setTitle(`${emoji.gift} Feliz aniversário!`)
    .setDescription([
      `${emoji.party} Hoje é o aniversário de ${user}!`,
      `${emoji.clap} Deixem os parabéns e muitos cookies imaginários.`,
    ].join("\n"))
    .setThumbnail(user.displayAvatarURL({ size: 256 }));
}

async function deliverBirthday(client: Client, birthday: BirthdayRecord, year: number): Promise<boolean> {
  const user = await client.users.fetch(birthday.userId).catch((error: unknown) => {
    logger.warn("Não foi possível buscar usuário para aniversário", {
      guildId: birthday.guildId,
      userId: birthday.userId,
      error: errorMessage(error),
    });
    return null;
  });
  if (!user) return false;

  const payload = {
    content: `${emoji.gift} Parabéns, ${user}!`,
    embeds: [buildBirthdayEmbed(user)],
  };

  const channel = await client.channels.fetch(birthday.channelId).catch((error: unknown) => {
    logger.warn("Não foi possível buscar canal de aniversário", {
      guildId: birthday.guildId,
      channelId: birthday.channelId,
      error: errorMessage(error),
    });
    return null;
  });

  const sendableChannel = channel?.isTextBased() && "send" in channel
    ? channel
    : null;

  if (sendableChannel && typeof sendableChannel.send === "function") {
    try {
      await sendableChannel.send(payload);
      markBirthdaySent(birthday.guildId, birthday.userId, year);
      return true;
    } catch (error) {
      logger.warn("Falha ao enviar aniversário no canal configurado", {
        guildId: birthday.guildId,
        channelId: birthday.channelId,
        error: errorMessage(error),
      });
    }
  }

  try {
    await user.send(payload);
    markBirthdaySent(birthday.guildId, birthday.userId, year);
    return true;
  } catch (error) {
    logger.warn("Falha ao enviar aniversário por mensagem privada", {
      guildId: birthday.guildId,
      userId: birthday.userId,
      error: errorMessage(error),
    });
    return false;
  }
}

async function deliverDueBirthdays(client: Client): Promise<void> {
  if (birthdayRunning) return;
  birthdayRunning = true;

  const { year } = nowParts();
  const due = dueBirthdays();

  try {
    for (const birthday of due) {
      await deliverBirthday(client, birthday, year);
    }
  } finally {
    birthdayRunning = false;
  }
}

export function startBirthdayScheduler(client: Client): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  deliverDueBirthdays(client).catch(error =>
    logger.error("Falha no scheduler de aniversários", error)
  );
  setInterval(() => {
    deliverDueBirthdays(client).catch(error =>
      logger.error("Falha no scheduler de aniversários", error)
    );
  }, 60 * 60 * 1000);
}
