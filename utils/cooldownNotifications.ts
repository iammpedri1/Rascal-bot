const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const db = require("./db");
const cooldowns = require("./cooldowns");
const emoji = require("./emojis");
const logger = require("./logger");
const { randomColor } = require("./embedStyle") as { randomColor: () => number };

const COMMANDS = {
  daily: { label: "/daily", get icon() { return emoji.cookie; } },
  trabalhar: { label: "/trabalhar", get icon() { return emoji.work; } },
};
const NOTIFICATION_BELL = { name: "Sino", id: "1501626669473992775", animated: true };
let schedulerStarted = false;
let deliveryRunning = false;

function getPending(userId, command) {
  return db.prepare(`
    SELECT notify_at AS notifyAt
    FROM cooldown_notifications
    WHERE user_id = ? AND command = ? AND status = 'pending'
  `).get(String(userId), command) || null;
}

function subscribe(userId, command, notifyAt) {
  if (!COMMANDS[command]) return false;
  const nextAt = Math.max(Date.now(), Number(notifyAt) || 0);
  db.prepare(`
    INSERT INTO cooldown_notifications (user_id, command, notify_at, status, created_at, notified_at)
    VALUES (?, ?, ?, 'pending', ?, NULL)
    ON CONFLICT(user_id, command) DO UPDATE SET
      notify_at = excluded.notify_at,
      status = 'pending',
      created_at = excluded.created_at,
      notified_at = NULL
  `).run(String(userId), command, nextAt, Date.now());
  return true;
}

function cancel(userId, command) {
  return db.prepare(`
    UPDATE cooldown_notifications SET status = 'cancelled'
    WHERE user_id = ? AND command = ? AND status = 'pending'
  `).run(String(userId), command).changes > 0;
}

function buildButtons(userId, stateByCommand = {}, nextAtByCommand = {}, commands = Object.keys(COMMANDS), guild = null) {
  const row = new ActionRowBuilder();
  const visibleCommands = commands.filter(command => COMMANDS[command]);
  for (const command of visibleCommands) {
    const config = COMMANDS[command];
    const pending = Object.prototype.hasOwnProperty.call(stateByCommand, command)
      ? stateByCommand[command]
      : getPending(userId, command);
    const nextAt = Number(nextAtByCommand[command]) || cooldowns.get(userId, command).expiresAt;
    const button = new ButtonBuilder()
      .setCustomId(`cooldownnotify|${command}|${userId}|${nextAt}|${visibleCommands.join(",")}`)
      .setStyle(pending ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setLabel("Notificar próximo trabalho")
      .setDisabled(!pending && nextAt <= Date.now());
    button.setEmoji(NOTIFICATION_BELL);
    row.addComponents(button);
  }
  return [row];
}

async function handleButton(interaction) {
  const [, command, ownerId, nextAtRaw, scopeRaw] = interaction.customId.split("|");
  const visibleCommands = (scopeRaw || Object.keys(COMMANDS).join(","))
    .split(",")
    .filter(item => COMMANDS[item]);
  if (!COMMANDS[command]) return interaction.reply({ content: "Esse aviso não é válido.", flags: 64, allowedMentions: { repliedUser: false } });
  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: "Esse botão pertence a outra pessoa.", flags: 64, allowedMentions: { repliedUser: false } });
  }

  const pending = getPending(ownerId, command);
  if (pending) {
    cancel(ownerId, command);
    return interaction.update({
      content: `${emoji.correct} Aviso de ${COMMANDS[command].label} cancelado.`,
      embeds: interaction.message.embeds,
      components: buildButtons(ownerId, { [command]: false }, { [command]: Number(nextAtRaw) }, visibleCommands, interaction.guild),
    });
  }

  const current = cooldowns.get(ownerId, command);
  const notifyAt = Math.max(Number(nextAtRaw) || 0, current.expiresAt || 0, Date.now());
  if (notifyAt <= Date.now()) {
    return interaction.reply({ content: `${emoji.correct} ${COMMANDS[command].label} já está pronto.`, flags: 64, allowedMentions: { repliedUser: false } });
  }
  subscribe(ownerId, command, notifyAt);
  return interaction.update({
    content: `${emoji.clock} Vou avisar você por mensagem direta quando ${COMMANDS[command].label} estiver pronto.`,
    embeds: interaction.message.embeds,
    components: buildButtons(ownerId, { [command]: true }, {}, visibleCommands, interaction.guild),
  });
}

async function deliverDue(client) {
  if (deliveryRunning) return;
  deliveryRunning = true;
  try {
    const due = db.prepare(`
      SELECT user_id AS userId, command
      FROM cooldown_notifications
      WHERE status = 'pending' AND notify_at <= ?
      ORDER BY notify_at ASC
      LIMIT 25
    `).all(Date.now());
    for (const row of due) {
      const config = COMMANDS[row.command];
      if (!config) {
        cancel(row.userId, row.command);
        continue;
      }
      let delivered = false;
      try {
        const user = await client.users.fetch(row.userId);
        await user.send({ embeds: [new EmbedBuilder()
          .setColor(randomColor())
          .setTitle(`${emoji.clock} ${config.label} está pronto`)
          .setDescription(`${emoji.correct} Você já pode usar ${config.label} novamente.`)
          .setTimestamp()] });
        delivered = true;
      } catch (error) {
        logger.warn("Não foi possível enviar aviso de cooldown por DM", {
          command: row.command,
          userId: row.userId,
          code: (error as any)?.code,
        });
      }
      db.prepare(`
        UPDATE cooldown_notifications SET status = ?, notified_at = ?
        WHERE user_id = ? AND command = ? AND status = 'pending'
      `).run(delivered ? "sent" : "failed", Date.now(), row.userId, row.command);
    }
  } finally {
    deliveryRunning = false;
  }
}

function startCooldownNotificationScheduler(client) {
  if (schedulerStarted) return;
  schedulerStarted = true;
  void deliverDue(client);
  const timer = setInterval(() => void deliverDue(client), 30 * 1000);
  timer.unref?.();
}

module.exports = { buildButtons, handleButton, getPending, startCooldownNotificationScheduler };
