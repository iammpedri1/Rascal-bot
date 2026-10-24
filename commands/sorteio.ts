import { defineCommand } from "../types/command";
const crypto = require("crypto");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js") as typeof import("discord.js");
const db = require("../utils/db");
const emoji = require("../utils/emojis");
const logger = require("../utils/logger");
const { PRIMARY_GUILD_ID } = require("../utils/primaryGuild");
const { randomColor } = require("../utils/embedStyle") as { randomColor: () => number };

const CHECK_INTERVAL_MS = 30 * 1000;
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const activeDraws = new Set();
let schedulerStarted = false;

function parseDuration(value) {
  const match = String(value || "").trim().toLowerCase().match(/^([1-9]\d*)\s*(m|min|h|d)$/);
  if (!match) return null;
  const unit = match[2];
  const multiplier = unit.startsWith("m") ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  const duration = Number(match[1]) * multiplier;
  return duration >= 60_000 && duration <= MAX_DURATION_MS ? duration : null;
}

function isManager(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageEvents)
    || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function getGiveaway(id) {
  const row = db.prepare(`
    SELECT id, guild_id AS guildId, channel_id AS channelId, message_id AS messageId,
      created_by AS createdBy, prize, winner_count AS winnerCount, ends_at AS endsAt,
      status, winner_ids AS winnerIds, announcement_sent AS announcementSent, created_at AS createdAt
    FROM giveaways WHERE id = ?
  `).get(Number(id));
  if (!row) return null;
  return { ...row, winnerIds: JSON.parse(row.winnerIds || "[]") };
}

function participantCount(id) {
  return Number(db.prepare("SELECT COUNT(*) AS count FROM giveaway_participants WHERE giveaway_id = ?").get(Number(id))?.count) || 0;
}

function buildEmbed(giveaway) {
  const count = participantCount(giveaway.id);
  const winners = giveaway.winnerIds.length
    ? giveaway.winnerIds.map(userId => `<@${userId}>`).join(", ")
    : null;
  const description = giveaway.status === "open"
    ? [
      `${emoji.gift} Prêmio: **${giveaway.prize}**`,
      `${emoji.clock} Encerra <t:${Math.floor(giveaway.endsAt / 1000)}:R> (<t:${Math.floor(giveaway.endsAt / 1000)}:F>)`,
      `🏆 Vencedores: **${giveaway.winnerCount}** · 👥 Participantes: **${count}**`,
      "",
      "Clique no botão para participar. Cada pessoa pode entrar uma vez.",
    ].join("\n")
    : giveaway.status === "cancelled"
      ? [
        `${emoji.gift} Prêmio: **${giveaway.prize}**`,
        "Este sorteio foi cancelado pela equipe.",
        `👥 Participações registradas: **${count}**`,
      ].join("\n")
      : [
      `${emoji.gift} Prêmio: **${giveaway.prize}**`,
      `🏆 Vencedores sorteados: ${winners || "_ninguém; não houve participantes_"}`,
      `👥 Participantes: **${count}**`,
      ].join("\n");

  return new EmbedBuilder()
    .setColor(randomColor())
    .setTitle(`${emoji.gift} ${giveaway.status === "cancelled" ? "SORTEIO CANCELADO" : "SORTEIO"} · ${giveaway.prize}`.slice(0, 256))
    .setDescription(description)
    .setFooter({ text: `Sorteio #${giveaway.id} · organizado por ${giveaway.createdBy}` })
    .setTimestamp(giveaway.createdAt);
}

function buildComponents(giveaway): Array<import("discord.js").ActionRowBuilder<import("discord.js").ButtonBuilder>> {
  return [new ActionRowBuilder<import("discord.js").ButtonBuilder>().addComponents(new ButtonBuilder()
    .setCustomId(`sorteio|participar|${giveaway.id}`)
    .setStyle(giveaway.status === "open" ? ButtonStyle.Success : ButtonStyle.Secondary)
    .setEmoji(emoji.toComponentEmoji(emoji.party))
    .setLabel(giveaway.status === "open" ? `Participar · ${participantCount(giveaway.id)}` : "Sorteio encerrado")
    .setDisabled(giveaway.status !== "open"))];
}

async function getOriginalMessage(client, giveaway) {
  if (!giveaway.messageId) return null;
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return null;
  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  return { channel, message };
}

async function ensureGiveawayMessage(client, giveaway) {
  const existing = await getOriginalMessage(client, giveaway);
  if (existing?.message) return existing;
  const channel = existing?.channel || await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return null;
  const message = await channel.send({ embeds: [buildEmbed(giveaway)], components: buildComponents(giveaway) });
  db.prepare("UPDATE giveaways SET message_id = ? WHERE id = ?")
    .run(String(message.id), giveaway.id);
  return { channel, message };
}

function drawWinners(participants, count, excluded = []) {
  const excludedSet = new Set(excluded.map(String));
  const eligible = participants.map(row => String(row.userId)).filter(id => !excludedSet.has(id));
  const winners = [];
  while (eligible.length && winners.length < count) {
    const index = crypto.randomInt(eligible.length);
    winners.push(eligible[index]);
    eligible.splice(index, 1);
  }
  return winners;
}

async function announceEnd(client, giveaway) {
  const original = await ensureGiveawayMessage(client, giveaway);
  if (!original) return false;
  await original.message.edit({ embeds: [buildEmbed(giveaway)], components: buildComponents(giveaway) });

  if (!giveaway.announcementSent) {
    const mentions = giveaway.winnerIds.map(String);
    const announcement = mentions.length
      ? `${emoji.party} Parabéns ${mentions.map(id => `<@${id}>`).join(", ")}! Vocês ganharam **${giveaway.prize}**.`
      : `${emoji.gift} O sorteio de **${giveaway.prize}** terminou sem participantes.`;
    await original.channel.send({
      content: announcement,
      allowedMentions: { users: mentions },
    });
    db.prepare("UPDATE giveaways SET announcement_sent = 1 WHERE id = ?").run(giveaway.id);
  }
  return true;
}

async function finishGiveaway(client, id) {
  if (activeDraws.has(Number(id))) return;
  activeDraws.add(Number(id));
  try {
    let giveaway = getGiveaway(id);
    if (!giveaway || giveaway.status === "cancelled") return;
    if (giveaway.status === "open") {
      const participants = db.prepare(`
        SELECT user_id AS userId FROM giveaway_participants WHERE giveaway_id = ? ORDER BY joined_at ASC
      `).all(giveaway.id);
      const winnerIds = drawWinners(participants, giveaway.winnerCount, giveaway.winnerIds);
      db.prepare(`UPDATE giveaways SET status = 'ended', winner_ids = ?, ends_at = ? WHERE id = ? AND status = 'open'`)
        .run(JSON.stringify(winnerIds), Date.now(), giveaway.id);
      giveaway = getGiveaway(id);
    }
    await announceEnd(client, giveaway);
  } finally {
    activeDraws.delete(Number(id));
  }
}

async function startGiveaway(interaction, client) {
  const prize = interaction.options.getString("premio", true).trim();
  const durationMs = parseDuration(interaction.options.getString("duracao", true));
  const winnerCount = interaction.options.getInteger("vencedores", true);
  const channel = interaction.options.getChannel("canal") || interaction.channel;
  if (!durationMs) return interaction.reply({ content: "Duração inválida. Use `10m`, `2h` ou `3d` (máximo de 30 dias).", flags: 64 });
  if (prize.length < 2 || prize.length > 180) return interaction.reply({ content: "O prêmio precisa ter entre 2 e 180 caracteres.", flags: 64 });
  if (!channel?.isTextBased?.() || channel.type === ChannelType.DM) return interaction.reply({ content: "Escolha um canal de texto do servidor.", flags: 64 });
  if (winnerCount < 1 || winnerCount > 10) return interaction.reply({ content: "Escolha de 1 a 10 vencedores.", flags: 64 });

  await interaction.deferReply({ flags: 64 });
  const result = db.prepare(`
    INSERT INTO giveaways (guild_id, channel_id, created_by, prize, winner_count, ends_at, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
  `).run(String(interaction.guildId), String(channel.id), String(interaction.user.id), prize, winnerCount, Date.now() + durationMs, Date.now());
  let giveaway = getGiveaway(result.lastInsertRowid);
  try {
    const message = await channel.send({ embeds: [buildEmbed(giveaway)], components: buildComponents(giveaway) });
    db.prepare("UPDATE giveaways SET message_id = ? WHERE id = ?").run(String(message.id), giveaway.id);
    return interaction.editReply(`Sorteio **#${giveaway.id}** publicado em <#${channel.id}> e encerra <t:${Math.floor(giveaway.endsAt / 1000)}:R>.`);
  } catch (error) {
    db.prepare("DELETE FROM giveaways WHERE id = ?").run(giveaway.id);
    logger.error("Falha ao publicar sorteio", error, { guild: interaction.guildId, channel: channel.id });
    return interaction.editReply("Não consegui publicar o sorteio. Confira minhas permissões no canal.");
  }
}

async function rerollGiveaway(interaction, client) {
  const id = interaction.options.getInteger("id", true);
  let giveaway = getGiveaway(id);
  if (!giveaway || giveaway.guildId !== interaction.guildId || giveaway.status !== "ended") {
    return interaction.reply({ content: "Não encontrei um sorteio encerrado com esse ID neste servidor.", flags: 64 });
  }
  const participants = db.prepare(`SELECT user_id AS userId FROM giveaway_participants WHERE giveaway_id = ?`).all(id);
  const winner = drawWinners(participants, 1, giveaway.winnerIds)[0];
  if (!winner) return interaction.reply({ content: "Não há outro participante elegível para sortear.", flags: 64 });
  await interaction.deferReply({ flags: 64 });
  giveaway.winnerIds.push(winner);
  db.prepare("UPDATE giveaways SET winner_ids = ? WHERE id = ?").run(JSON.stringify(giveaway.winnerIds), id);
  const original = await getOriginalMessage(client, giveaway);
  if (original?.message) await original.message.edit({ embeds: [buildEmbed(giveaway)], components: buildComponents(giveaway) });
  await interaction.editReply({ content: `${emoji.party} Novo vencedor do sorteio **#${id}**: <@${winner}>!`, allowedMentions: { users: [winner] } });
}

async function endGiveaway(interaction, client) {
  const id = interaction.options.getInteger("id", true);
  const giveaway = getGiveaway(id);
  if (!giveaway || giveaway.guildId !== interaction.guildId || giveaway.status !== "open") {
    return interaction.reply({ content: "Não encontrei um sorteio aberto com esse ID neste servidor.", flags: 64 });
  }
  await interaction.deferReply({ flags: 64 });
  db.prepare("UPDATE giveaways SET ends_at = ? WHERE id = ?").run(Date.now(), id);
  await finishGiveaway(client, id);
  return interaction.editReply({ content: `Sorteio **#${id}** encerrado.` });
}

async function cancelGiveaway(interaction, client) {
  const id = interaction.options.getInteger("id", true);
  const giveaway = getGiveaway(id);
  if (!giveaway || giveaway.guildId !== interaction.guildId || giveaway.status !== "open") {
    return interaction.reply({ content: "Não encontrei um sorteio aberto com esse ID neste servidor.", flags: 64 });
  }
  await interaction.deferReply({ flags: 64 });
  db.prepare("UPDATE giveaways SET status = 'cancelled' WHERE id = ? AND status = 'open'").run(id);
  const cancelled = getGiveaway(id);
  const original = await getOriginalMessage(client, giveaway);
  if (original?.message) {
    await original.message.edit({ embeds: [buildEmbed(cancelled)], components: buildComponents(cancelled) });
  }
  return interaction.editReply({ content: `Sorteio **#${id}** cancelado.` });
}

module.exports = defineCommand({
  category: "community",
  data: new SlashCommandBuilder()
    .setName("sorteio")
    .setDescription("Crie e gerencie sorteios com participação por botão")
    .setDMPermission(false)
    .addSubcommand(command => command.setName("criar").setDescription("Publica um sorteio com encerramento automático")
      .addStringOption(option => option.setName("premio").setDescription("Prêmio do sorteio").setRequired(true).setMaxLength(180))
      .addStringOption(option => option.setName("duracao").setDescription("Tempo até encerrar, como 30m, 2h ou 1d").setRequired(true))
      .addIntegerOption(option => option.setName("vencedores").setDescription("Quantidade de vencedores").setMinValue(1).setMaxValue(10).setRequired(true))
      .addChannelOption(option => option.setName("canal").setDescription("Canal de publicação").addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(command => command.setName("encerrar").setDescription("Encerra um sorteio aberto")
      .addIntegerOption(option => option.setName("id").setDescription("ID informado na criação").setMinValue(1).setRequired(true)))
    .addSubcommand(command => command.setName("cancelar").setDescription("Cancela um sorteio aberto sem escolher vencedores")
      .addIntegerOption(option => option.setName("id").setDescription("ID informado na criação").setMinValue(1).setRequired(true)))
    .addSubcommand(command => command.setName("rerolar").setDescription("Sorteia outro vencedor sem repetir os anteriores")
      .addIntegerOption(option => option.setName("id").setDescription("ID informado na criação").setMinValue(1).setRequired(true))),

  async execute(interaction, client) {
    if (!isManager(interaction)) return interaction.reply({ content: "Você precisa de Gerenciar Eventos para controlar sorteios.", flags: 64 });
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "criar") return startGiveaway(interaction, client);
    if (subcommand === "encerrar") return endGiveaway(interaction, client);
    if (subcommand === "cancelar") return cancelGiveaway(interaction, client);
    return rerollGiveaway(interaction, client);
  },

  async handleButton(interaction, client) {
    const [, action, idText] = interaction.customId.split("|");
    if (action !== "participar") return interaction.reply({ content: "Ação de sorteio inválida.", flags: 64 });
    const id = Number(idText);
    const giveaway = getGiveaway(id);
    if (!giveaway || giveaway.guildId !== interaction.guildId || giveaway.status !== "open" || giveaway.endsAt <= Date.now()) {
      return interaction.reply({ content: "Esse sorteio já foi encerrado.", flags: 64 });
    }
    if (interaction.user.bot) return interaction.reply({ content: "Bots não podem participar de sorteios.", flags: 64 });
    await interaction.deferUpdate();
    const added = db.prepare(`
      INSERT OR IGNORE INTO giveaway_participants (giveaway_id, user_id, joined_at) VALUES (?, ?, ?)
    `).run(id, String(interaction.user.id), Date.now()).changes > 0;
    await interaction.message.edit({ embeds: [buildEmbed(giveaway)], components: buildComponents(giveaway) }).catch(() => {});
    return interaction.followUp({
      content: added ? `${emoji.correct} Sua participação está registrada.` : `${emoji.info} Você já está participando deste sorteio.`,
      flags: 64,
    });
  },

  startScheduler(client) {
    if (schedulerStarted) return;
    schedulerStarted = true;
    const processDue = async () => {
      const due = db.prepare(`
        SELECT id FROM giveaways
        WHERE guild_id = ? AND ((status = 'open' AND ends_at <= ?) OR (status = 'ended' AND announcement_sent = 0))
        ORDER BY ends_at ASC LIMIT 10
      `).all(PRIMARY_GUILD_ID, Date.now());
      for (const row of due) await finishGiveaway(client, row.id);
    };
    void processDue().catch(error => logger.error("Falha ao recuperar sorteios", error));
    const timer = setInterval(() => void processDue().catch(error => logger.error("Falha no agendador de sorteios", error)), CHECK_INTERVAL_MS);
    timer.unref?.();
  },
});
