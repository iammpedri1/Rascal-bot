const { EmbedBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { handleAutoMod } = require("../utils/automod");
const { getAfk, removeAfk } = require("../utils/afkStore");
const { syncMemberLevelRoles } = require("../utils/communityManager");
const { addMessageXp } = require("../utils/xpSystem");

const AFK_REASON_EMOJI = "<:1000106078:1499822832757113024>";
const BOT_REPLY_GUILD_COOLDOWN = 45 * 1000;
const BOT_REPLY_USER_COOLDOWN = 2 * 60 * 1000;
const botReplyGuildCooldowns = new Map();
const botReplyUserCooldowns = new Map();

const greetingReplies = [
  `${emoji.lorittaCafune} Oi oi!`,
  `${emoji.correct} Opa! Tudo certo por aí?`,
  `${emoji.lorittaMegafone} Chamou? Estou por aqui.`,
  `${emoji.cookie} Oi! Aceita um cookie imaginário?`,
  `${emoji.clap} E aí!`,
];

const randomReplies = [
  `${emoji.thinking} Eu estava lendo o chat em silêncio.`,
  `${emoji.cookie} Alguém falou em cookies?`,
  `${emoji.lorittaMegafone} Passando só para dizer que eu existo.`,
  `${emoji.party} Esse servidor está movimentado hoje.`,
  `${emoji.clock} Lembrete aleatório: beba água.`,
];

function normalizeContent(content) {
  return String(content || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function canRandomReply(message) {
  const now = Date.now();
  const guildKey = message.guild.id;
  const userKey = `${message.guild.id}:${message.author.id}`;

  if ((botReplyGuildCooldowns.get(guildKey) || 0) > now) return false;
  if ((botReplyUserCooldowns.get(userKey) || 0) > now) return false;

  botReplyGuildCooldowns.set(guildKey, now + BOT_REPLY_GUILD_COOLDOWN);
  botReplyUserCooldowns.set(userKey, now + BOT_REPLY_USER_COOLDOWN);

  return true;
}

async function handleRandomBotReply(message) {
  if (!message.guild || message.author.bot || message.webhookId || message.system) return;
  if (!message.content || message.content.startsWith("/") || message.content.length > 180) return;
  if (!message.channel?.isTextBased?.()) return;

  const content = normalizeContent(message.content);
  const mentionedBot = message.mentions.users.has(message.client.user.id);
  const isGreeting = /^(oi|ola|opa|eai|e ai|bom dia|boa tarde|boa noite)(\W|$)/i.test(content);
  const shouldReply = mentionedBot || (isGreeting && Math.random() < 0.65) || Math.random() < 0.012;

  if (!shouldReply || !canRandomReply(message)) return;

  const replies = isGreeting || mentionedBot ? greetingReplies : randomReplies;
  const reply = replies[Math.floor(Math.random() * replies.length)];

  await message.reply({ content: reply }).catch(() => {});
}

async function handleAfk(message) {
  if (!message.guild || message.author.bot || message.webhookId || message.system) return;

  const current = removeAfk(message.guild.id, message.author.id);

  if (current) {
    const notice = await message.reply({
      content: `${emoji.correct} Bem-vindo de volta, ${message.author}! Removi seu AFK.`,
    }).catch(() => null);

    if (notice?.deletable) {
      setTimeout(() => notice.delete().catch(() => {}), 8000);
    }
  }

  const mentionedUsers = [...message.mentions.users.values()]
    .filter(user => !user.bot && user.id !== message.author.id);
  const seen = new Set();

  for (const user of mentionedUsers) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);

    const afk = getAfk(message.guild.id, user.id);
    if (!afk) continue;

    const timestamp = Math.floor(afk.createdAt / 1000);
    const notice = await message.reply({
      content: [
        `${emoji.clock} ${user} está AFK desde <t:${timestamp}:R>.`,
        `${AFK_REASON_EMOJI} **Motivo:** ${afk.reason}`,
      ].join("\n"),
    }).catch(() => null);

    if (notice?.deletable) {
      setTimeout(() => notice.delete().catch(() => {}), 12000);
    }
  }
}

module.exports = {
  name: "messageCreate",

  async execute(message) {
    const punished = await handleAutoMod(message);
    if (punished) return;

    await handleAfk(message);
    await handleRandomBotReply(message);

    const result = addMessageXp(message);
    if (!result) return;

    if (!result.leveledUp) {
      const notice = await message.channel.send({
        content: `${emoji.lorittaMegafone} ${message.author} ganhou **+${result.gained} XP**!`,
      }).catch(() => null);

      if (notice?.deletable) {
        setTimeout(() => notice.delete().catch(() => {}), 6000);
      }
      return;
    }

    const roleSync = await syncMemberLevelRoles(message.member, result.after.level);
    const roleLine = roleSync.added.length
      ? `\n${emoji.roles} Cargo recebido: **${roleSync.added.join(", ")}**`
      : "";

    const embed = new EmbedBuilder()
      .setColor(0xff6a00)
      .setTitle(`${emoji.lorittaCafune} Level up!`)
      .setDescription(
        [
          `${message.author} subiu para o **level ${result.after.level}**.`,
          `${emoji.lorittaMegafone} XP: **${result.after.totalXp}**${roleLine}`,
        ].join("\n")
      )
      .setThumbnail(message.author.displayAvatarURL({ size: 256 }));

    message.channel.send({ embeds: [embed] }).catch(() => {});
  },
};
