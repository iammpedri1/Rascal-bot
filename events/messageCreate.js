const { EmbedBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { addMessageXp } = require("../utils/xpSystem");

module.exports = {
  name: "messageCreate",

  async execute(message) {
    const result = addMessageXp(message);
    if (!result?.leveledUp) return;

    const embed = new EmbedBuilder()
      .setColor(0xff6a00)
      .setTitle(`${emoji.likeLed} Level up!`)
      .setDescription(
        [
          `${message.author} subiu para o **level ${result.after.level}**.`,
          `XP: **${result.after.totalXp}**`,
        ].join("\n")
      )
      .setThumbnail(message.author.displayAvatarURL({ size: 256 }));

    message.channel.send({ embeds: [embed] }).catch(() => {});
  },
};
