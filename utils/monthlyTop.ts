const { EmbedBuilder } = require("discord.js");
const db = require("./db");
const emoji = require("./emojis");
const logger = require("./logger");
const { randomColor } = require("./embedStyle") as { randomColor: () => number };
const { getMonthlyMessageLeaderboard, monthKey: messageMonthKey } = require("./messageStats");
const { getMonthlyVoiceLeaderboard } = require("./voiceStats");
const { isPrimaryGuild } = require("./primaryGuild");

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const ROLE_NAMES = {
  messages: "Top 1 Mensagens",
  voice: "Top 1 Voz",
};

let schedulerStarted = false;

function monthKey(now = Date.now()) {
  return messageMonthKey(now);
}

function previousMonthKey(current) {
  const [year, month] = current.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

async function assignMonthlyRoles(guild: import("discord.js").Guild, month: string) {
  const messages = getMonthlyMessageLeaderboard(guild.id, month, 1);
  const voice = getMonthlyVoiceLeaderboard(guild.id, month, 1);

  const assignments = [
    { type: "messages" as const, winner: messages[0], roleName: ROLE_NAMES.messages },
    { type: "voice" as const, winner: voice[0], roleName: ROLE_NAMES.voice },
  ];

  for (const { type, winner, roleName } of assignments) {
    if (!winner) continue;

    const role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
      logger.warn(`Cargo de ranking não encontrado: "${roleName}" no servidor ${guild.name}`);
      continue;
    }

    // Remover vencedor anterior
    const prev = db.prepare(`
      SELECT user_id FROM monthly_role_assignments 
      WHERE guild_id = ? AND rank_type = ?
      ORDER BY assigned_at DESC LIMIT 1
    `).get(guild.id, type);

    if (prev && prev.user_id !== winner.id) {
      const prevMember = await guild.members.fetch(prev.user_id).catch(() => null);
      if (prevMember) await prevMember.roles.remove(role, `Novo vencedor do mês: ${month}`).catch(() => null);
    }

    // Atribuir novo vencedor
    const member = await guild.members.fetch(winner.id).catch(() => null);
    if (member) {
      await member.roles.add(role, `Vencedor do ranking mensal (${type}): ${month}`).catch(() => null);
      db.prepare(`
        INSERT OR REPLACE INTO monthly_role_assignments (guild_id, user_id, role_id, rank_type, assigned_at, month_key)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(guild.id, winner.id, role.id, type, Date.now(), month);
    }
  }
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

  await assignMonthlyRoles(channel.guild, targetMonth);

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
