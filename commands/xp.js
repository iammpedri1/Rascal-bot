const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { getXp } = require("../utils/xpSystem");

function amount(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function levelReward(level) {
  return Math.max(250, Math.floor((level + 1) * 275));
}

module.exports = {
  category: "user",

  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Mostra seu cartão de XP")
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
    const reward = levelReward(nextLevel);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setAuthor({
        name: `${user.username}#${user.discriminator}`,
        iconURL: user.displayAvatarURL({ size: 128 }),
      })
      .setDescription(`${emoji.ticket} **Cartão de Perfil do Servidor**`)
      .addFields(
        {
          name: `${emoji.staffLed} Nível atual`,
          value: `Nível ${xp.level}`,
          inline: true,
        },
        {
          name: `${emoji.cookie} XP Atual`,
          value: `${amount(xp.totalXp)} XP`,
          inline: true,
        },
        {
          name: `${emoji.clap} Colocação`,
          value: `#${amount(xp.rank.position)}`,
          inline: true,
        },
        {
          name: `${emoji.clock} XP necessário para o próximo nível\n(${amount(xp.progress)} / ${amount(xp.needed)} XP)`,
          value: amount(xp.remaining),
          inline: true,
        },
        {
          name: `${emoji.gift} Próxima Recompensa`,
          value: `Ganhe +${amount(reward)} XP para ganhar **Level +1**!`,
          inline: true,
        },
        {
          name: `${emoji.thinking} Dicas e Manhas do Driscord Brasil`,
          value: "Continue conversando para passar de nível. Eu sei que você vai conseguir!",
          inline: false,
        }
      )
      .setThumbnail(user.displayAvatarURL({ size: 256 }));

    return interaction.reply({ embeds: [embed] });
  },
};
