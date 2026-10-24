const { EmbedBuilder } = require("discord.js");
const db = require("./db");
const emoji = require("./emojis");
const logger = require("./logger");
const { randomColor } = require("./embedStyle") as { randomColor: () => number };
const { getMonthlyMessageLeaderboard, monthKey: messageMonthKey } = require("./messageStats");
const { getMonthlyVoiceLeaderboard } = require("./voiceStats");
const { isPrimaryGuild } = require("./primaryGuild");

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
let schedulerStarted = false;

function monthKey(now = Date.now()) {
  return messageMonthKey(now);
}

function previousMonthKey(current) {
  const [year, month] = current.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function durationLabel(seconds) {
  const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}min`;
}

function rankedLines(rows, metric) {
  if (!rows.length) return "_Sem atividade registrada neste mês._";
  const medals = ["🥇", "🥈", "🥉", "⭐", "⭐"];
  return rows.map((row, index) => {
    const score = metric === "messages"
      ? `${Number(row.messages).toLocaleString("pt-BR")} mensagens`
      : durationLabel(row.seconds);
    return `${medals[index]} <@${row.id}> — **${score}**`;
  }).join("\n");
}

function buildMonthlyTopEmbed(guild, month) {
  const messages = getMonthlyMessageLeaderboard(guild.id, month, 5);
  const voice = getMonthlyVoiceLeaderboard(guild.id, month, 5);
  const trophy = emoji.trophy || "🏆";
  return new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${trophy} » TOP membros mais ATIVOS`)
    .setDescription([
      `**${guild.name}** · ${monthLabel(month)}`,
      "",
      `${trophy} » **Top 5 Mensagens:**`,
      rankedLines(messages, "messages"),
      "",
      `${emoji.voice} » **Top 5 Voz:**`,
      rankedLines(voice, "voice"),
      "",
      "💞 Obrigado a todos que participaram e mantiveram a comunidade ativa!",
    ].join("\n"))
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .setFooter({ text: "Classificação mensal de mensagens e tempo em voz" })
    .setTimestamp();
}

async function publishPreviousMonth(client) {
  const channelId = String(process.env.MONTHLY_TOP_CHANNEL_ID || "").trim();
  if (!channelId) return;

  const currentMonth = monthKey();
  const activation = db.prepare(`
    SELECT value FROM system_settings WHERE key = 'monthly_top_activated_month'
  `).get();
  if (!activation) {
    db.prepare(`INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('monthly_top_activated_month', ?, ?)`)
      .run(currentMonth, Date.now());
    return;
  }

  const targetMonth = previousMonthKey(currentMonth);
  if (targetMonth < activation.value) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.() || !channel.guild) {
    logger.warn("Canal de ranking mensal não encontrado ou não é textual", { channelId });
    return;
  }
  if (!isPrimaryGuild(channel.guild.id)) {
    logger.warn("Canal do ranking mensal não pertence ao servidor exclusivo do Rascal", {
      guildId: channel.guild.id,
    });
    return;
  }
  const posted = db.prepare(`
    SELECT 1 FROM monthly_top_posts WHERE guild_id = ? AND month_key = ?
  `).get(String(channel.guild.id), targetMonth);
  if (posted) return;

  await channel.send({
    embeds: [buildMonthlyTopEmbed(channel.guild, targetMonth)],
    allowedMentions: { parse: [] },
  });
  db.prepare(`
    INSERT OR IGNORE INTO monthly_top_posts (guild_id, month_key, posted_at) VALUES (?, ?, ?)
  `).run(String(channel.guild.id), targetMonth, Date.now());
  logger.success("Ranking mensal publicado", { guild: channel.guild.name, month: targetMonth });
}

function startMonthlyTopScheduler(client) {
  if (schedulerStarted) return;
  schedulerStarted = true;
  void publishPreviousMonth(client).catch(error => logger.error("Falha ao publicar ranking mensal", error));
  const timer = setInterval(() => {
    void publishPreviousMonth(client).catch(error => logger.error("Falha ao publicar ranking mensal", error));
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
}

module.exports = { buildMonthlyTopEmbed, monthKey, startMonthlyTopScheduler };
