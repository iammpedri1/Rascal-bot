const { EmbedBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { addMessageXp } = require("../utils/xpSystem");

module.exports = {
  name: "messageCreate",

  async execute(message) {
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
