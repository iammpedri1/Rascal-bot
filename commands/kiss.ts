const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const emoji = "<a:ablobcouple:1500896909332840569>";

async function getGif() {
  try {
    const res = await fetch("https://nekos.best/api/v2/kiss");
    const data = await res.json();
    return data.results?.[0]?.url;
  } catch {
    return null;
  }
}

module.exports = {
  category: "action",

  data: new SlashCommandBuilder()
    .setName("kiss")
    .setDescription("Beijar alguém")
    .addUserOption(opt =>
      opt.setName("usuario")
        .setDescription("Quem você quer beijar")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const target = interaction.options.getUser("usuario");
      const gif = await getGif();

      const embed = new EmbedBuilder()
        .setColor(0xFF6B9D)
        .setTitle(`${emoji} Beijo`)
        .setDescription(`<@${interaction.user.id}> beijou <@${target.id}>!`)
        .setImage(gif || "https://media.tenor.com/5R_cZkzk2RQAAAAC/anime-kiss.gif");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`kiss|${interaction.user.id}|${target.id}`)
          .setLabel("Retribuir")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

    } catch (err) {
      console.error(err);

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "❌ Erro no comando kiss",
          flags: 64,
        });
      } else {
        await interaction.reply({
          content: "❌ Erro no comando kiss",
          flags: 64,
        });
      }
    }
  },

  async handleButton(interaction) {
    if (!interaction.customId.startsWith("kiss|")) return;

    try {
      const [, authorId, targetId] = interaction.customId.split("|");

      if (interaction.user.id !== targetId) {
        return interaction.reply({
          content: "❌ Só quem recebeu pode retribuir!",
          flags: 64,
        });
      }

      const gif = await getGif();

      const embed = new EmbedBuilder()
        .setColor(0xFF6B9D)
        .setTitle(`${emoji} Retribuição`)
        .setDescription(`<@${interaction.user.id}> retribuiu o beijo de <@${authorId}>!`)
        .setImage(gif || "https://media.tenor.com/5R_cZkzk2RQAAAAC/anime-kiss.gif");

      await interaction.reply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
    }
  },
};
