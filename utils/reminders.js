const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const emoji = require("./emojis");

const dataDir = path.join(__dirname, "../data");
const dataFile = path.join(dataDir, "reminders.json");
const CLOCK_EMOJI = emoji.clock;
const MAX_DONE_REMINDERS = 50;
const DUPLICATE_WINDOW_MS = 5 * 1000;
const DELIVERY_LOCK_MS = 2 * 60 * 1000;

let schedulerStarted = false;
let deliveryRunning = false;

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ reminders: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();

  try {
    const store = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return {
      reminders: Array.isArray(store.reminders) ? store.reminders : [],
    };
  } catch {
    return { reminders: [] };
  }
}

function writeStore(store) {
  ensureStore();
  const reminders = Array.isArray(store.reminders) ? store.reminders : [];
  const active = reminders.filter(reminder => !reminder.deliveredAt);
  const done = reminders
    .filter(reminder => reminder.deliveredAt)
    .sort((a, b) => b.deliveredAt - a.deliveredAt)
    .slice(0, MAX_DONE_REMINDERS);

  fs.writeFileSync(dataFile, JSON.stringify({ reminders: [...active, ...done] }, null, 2));
}

function timestamp(ms) {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

function absoluteTimestamp(ms) {
  return `<t:${Math.floor(ms / 1000)}:F>`;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function createReminder({ userId, channelId, guildId, message, dueAt }) {
  const store = readStore();
  const now = Date.now();
  const normalizedMessage = normalizeText(message);
  const duplicate = store.reminders.find(reminder =>
    !reminder.deliveredAt &&
    reminder.userId === userId &&
    reminder.channelId === channelId &&
    normalizeText(reminder.message) === normalizedMessage &&
    Math.abs(reminder.dueAt - dueAt) <= DUPLICATE_WINDOW_MS &&
    now - reminder.createdAt <= DUPLICATE_WINDOW_MS
  );

  if (duplicate) return duplicate;

  const reminder = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    channelId,
    guildId,
    message,
    dueAt,
    createdAt: now,
    deliveredAt: null,
  };

  store.reminders.push(reminder);
  writeStore(store);
  return reminder;
}

function buildScheduledEmbed(user, reminder) {
  return new EmbedBuilder()
    .setColor(0x2ad4d9)
    .setTitle(`${CLOCK_EMOJI} Seus Lembretes`)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setDescription(
      [
        `${emoji.cookie} \u00bb **Lembrete** • ${timestamp(reminder.dueAt)}`,
        `${emoji.channel} \u00bb **${reminder.message}** esta salvo.`,
        `\u21B3 Eu vou te chamar quando chegar a hora. \uD83D\uDD14`,
        "",
        `${CLOCK_EMOJI} \u00bb Marcado para ${absoluteTimestamp(reminder.dueAt)}.`,
        `${emoji.thinking} \u00bb Dica: use lembretes para /work, /daily ou tarefas importantes.`,
      ].join("\n")
    );
}

function buildReminderEmbed(reminder) {
  return new EmbedBuilder()
    .setColor(0x2ad4d9)
    .setTitle(`${CLOCK_EMOJI} Seus Lembretes`)
    .setDescription(
      [
        `${emoji.cookie} \u00bb **Lembrete** esta pronto! \uD83D\uDD14`,
        `\u21B3 ${reminder.message}`,
        "",
        `${CLOCK_EMOJI} \u00bb Criado ${timestamp(reminder.createdAt)}.`,
        `${emoji.thinking} \u00bb Use **/lembrete** para agendar outro aviso.`,
      ].join("\n")
    );
}

async function sendReminder(client, reminder) {
  const embed = buildReminderEmbed(reminder);

  try {
    const channel = await client.channels.fetch(reminder.channelId);

    if (channel?.isTextBased()) {
      await channel.send({
        content: `<@${reminder.userId}>`,
        embeds: [embed],
      });
      return true;
    }
  } catch {}

  try {
    const user = await client.users.fetch(reminder.userId);
    await user.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}

async function deliverDueReminders(client) {
  if (deliveryRunning) return;
  deliveryRunning = true;

  const store = readStore();
  const now = Date.now();
  const due = store.reminders.filter(reminder => {
    if (reminder.deliveredAt || reminder.dueAt > now) return false;
    if (!reminder.deliveringAt) return true;
    return now - reminder.deliveringAt > DELIVERY_LOCK_MS;
  });

  try {
    for (const reminder of due) {
      reminder.deliveringAt = Date.now();
      writeStore(store);

      await sendReminder(client, reminder);
      reminder.deliveredAt = Date.now();
      delete reminder.deliveringAt;
      writeStore(store);
    }
  } finally {
    deliveryRunning = false;
  }
}

function startReminderScheduler(client) {
  if (schedulerStarted) return;
  schedulerStarted = true;

  deliverDueReminders(client).catch(console.error);
  setInterval(() => {
    deliverDueReminders(client).catch(console.error);
  }, 30 * 1000);
}

module.exports = {
  CLOCK_EMOJI,
  buildScheduledEmbed,
  createReminder,
  startReminderScheduler,
};
