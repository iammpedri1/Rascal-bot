const { EmbedBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { getAfk, removeAfk } = require("../utils/afkStore");
const { addMessageXp } = require("../utils/xpSystem");

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
        `${emoji.clock} ${user} est\u00e1 AFK desde <t:${timestamp}:R>.`,
        `${emoji.ticket} **Motivo:** ${afk.reason}`,
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
    await handleAfk(message);

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

    const embed = new EmbedBuilder()
      .setColor(0xff6a00)
      .setTitle(`${emoji.lorittaCafune} Level up!`)
      .setDescription(
        [
          `${message.author} subiu para o **level ${result.after.level}**.`,
          `${emoji.lorittaMegafone} XP: **${result.after.totalXp}**`,
        ].join("\n")
      )
      .setThumbnail(message.author.displayAvatarURL({ size: 256 }));

    message.channel.send({ embeds: [embed] }).catch(() => {});
  },
};
