const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { getXp } = require("../utils/xpSystem");

function bar(percent) {
  const total = 12;
  const filled = Math.round((percent / 100) * total);
  return "█".repeat(filled) + "░".repeat(Math.max(0, total - filled));
}

module.exports = {
  category: "user",

  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Mostra seu XP e level")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Usuário para consultar")
        .setRequired(false)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("user") || interaction.user;
    const xp = getXp(user.id);

    const embed = new EmbedBuilder()
      .setColor(0xff6a00)
      .setAuthor({
        name: `XP de ${user.username}`,
        iconURL: user.displayAvatarURL({ size: 256 }),
      })
      .setDescription(
        [
          `${emoji.likeLed} **Level:** ${xp.level}`,
          `${emoji.cookie} **XP total:** ${xp.totalXp.toLocaleString("pt-BR")}`,
          `${emoji.clock} **Progresso:** ${xp.progress.toLocaleString("pt-BR")}/${xp.needed.toLocaleString("pt-BR")} XP`,
          "",
          `\`${bar(xp.percent)}\` **${xp.percent}%**`,
        ].join("\n")
      )
      .addFields({
        name: "Como ganhar XP",
        value: [
          "💬 Mensagens: 15-28 XP a cada 60 segundos.",
          "🎁 /daily: 120 XP.",
          "💼 /trabalhar: 60 XP se der certo, 25 XP se falhar.",
          "🪙 Jogos/apostas: 80 XP ao vencer, 25 XP ao perder.",
          "🎟️ Rifa: 70 XP ao ganhar, 25 XP ao perder.",
        ].join("\n"),
      })
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
