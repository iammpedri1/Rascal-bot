const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { XP_CONFIG, getXp, xpForLevel } = require("../utils/xpSystem");

function amount(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function bar(percent) {
  const total = 14;
  const filled = Math.round((percent / 100) * total);
  return "\u2588".repeat(filled) + "\u2591".repeat(Math.max(0, total - filled));
}

module.exports = {
  category: "user",

  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Mostra seu XP e level")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Usuario para consultar")
        .setRequired(false)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("user") || interaction.user;
    const xp = getXp(user.id);
    const nextLevel = xp.level + 1;

    const embed = new EmbedBuilder()
      .setColor(0xff6a00)
      .setAuthor({
        name: `Perfil de XP de ${user.username}`,
        iconURL: user.displayAvatarURL({ size: 256 }),
      })
      .setDescription(
        [
          `${emoji.likeLed} **Level ${xp.level}**`,
          `\`${bar(xp.percent)}\` **${xp.percent}%**`,
          `${emoji.cookie} **${amount(xp.progress)} / ${amount(xp.needed)} XP** para o level ${nextLevel}`,
        ].join("\n")
      )
      .addFields(
        {
          name: "Resumo",
          value: [
            `XP total: \`${amount(xp.totalXp)}\``,
            `Faltam: \`${amount(xp.remaining)}\` XP`,
            `Ranking: \`#${amount(xp.rank.position)}\` de \`${amount(xp.rank.total)}\``,
            `Mensagens: \`${amount(xp.messagesCount)}\``,
          ].join("\n"),
          inline: true,
        },
        {
          name: "Ganho por mensagem",
          value: [
            `Base: \`${XP_CONFIG.baseMin}-${XP_CONFIG.baseMax} XP\``,
            `Cooldown: \`${Math.floor(XP_CONFIG.cooldownMs / 1000)}s\``,
            "Bonus: tamanho, palavras unicas, midia, respostas e sequencia ativa.",
            "Anti-spam: repeticao, flood e mensagens curtas nao farmam XP.",
          ].join("\n"),
          inline: false,
        },
        {
          name: "Proximos marcos",
          value: [
            `Level ${nextLevel}: \`${amount(xpForLevel(nextLevel))} XP total\``,
            `Level ${nextLevel + 1}: \`${amount(xpForLevel(nextLevel + 1))} XP total\``,
          ].join("\n"),
          inline: false,
        }
      )
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
