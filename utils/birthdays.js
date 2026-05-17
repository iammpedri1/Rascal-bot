const { EmbedBuilder } = require("discord.js");

const db = require("./db");
const emoji = require("./emojis");

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

function nowParts(date = new Date()) {
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function monthName(month) {
  return MONTHS[month - 1] || "mês inválido";
}

function maxDayForMonth(month) {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 0;
}

function isValidBirthday(day, month) {
  return Number.isInteger(day) &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= maxDayForMonth(month);
}

function formatBirthday(day, month) {
  return `${String(day).padStart(2, "0")} de ${monthName(month)}`;
}

function setBirthday({ guildId, userId, channelId, day, month }) {
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

function getBirthday(guildId, userId) {
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
  `).get(String(guildId), String(userId));
}

function removeBirthday(guildId, userId) {
  const result = db.prepare("DELETE FROM birthdays WHERE guild_id = ? AND user_id = ?")
    .run(String(guildId), String(userId));

  return result.changes > 0;
}

function dueBirthdays(date = new Date()) {
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
  `).all(day, month, year);
}

function markBirthdaySent(guildId, userId, year) {
  db.prepare(`
    UPDATE birthdays
    SET last_sent_year = ?, updated_at = ?
    WHERE guild_id = ? AND user_id = ?
  `).run(year, Date.now(), String(guildId), String(userId));
}

function buildBirthdayEmbed(user) {
  return new EmbedBuilder()
    .setColor(0xff9ac7)
    .setTitle(`${emoji.gift} Feliz aniversário!`)
    .setDescription(
      [
        `${emoji.party} Hoje é o aniversário de ${user}!`,
        `${emoji.clap} Deixem os parabéns e muitos cookies imaginários.`,
      ].join("\n")
    )
    .setThumbnail(user.displayAvatarURL({ size: 256 }));
}

async function deliverBirthday(client, birthday, year) {
  const user = await client.users.fetch(birthday.userId).catch(() => null);
  if (!user) {
    markBirthdaySent(birthday.guildId, birthday.userId, year);
    return;
  }

  const payload = {
    content: `${emoji.gift} Parabéns, ${user}!`,
    embeds: [buildBirthdayEmbed(user)],
  };

  const channel = await client.channels.fetch(birthday.channelId).catch(() => null);
  if (channel?.isTextBased()) {
    await channel.send(payload).catch(() => null);
  } else {
    await user.send(payload).catch(() => null);
  }

  markBirthdaySent(birthday.guildId, birthday.userId, year);
}

async function deliverDueBirthdays(client) {
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

function startBirthdayScheduler(client) {
  if (schedulerStarted) return;
  schedulerStarted = true;

  deliverDueBirthdays(client).catch(console.error);
  setInterval(() => {
    deliverDueBirthdays(client).catch(console.error);
  }, 60 * 60 * 1000);
}

module.exports = {
  formatBirthday,
  getBirthday,
  isValidBirthday,
  monthName,
  removeBirthday,
  setBirthday,
  startBirthdayScheduler,
};
