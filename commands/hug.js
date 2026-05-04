const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const emoji = "<:blobhug2:1500896963317600276>";

async function getGif() {
  try {
    const res = await fetch("https://nekos.best/api/v2/hug");
    const data = await res.json();
    return data.results?.[0]?.url;
  } catch {
    return null;
  }
}

module.exports = {
  category: "action",

  data: new SlashCommandBuilder()
    .setName("hug")
    .setDescription("Abraçar alguém")
    .addUserOption(opt =>
      opt.setName("usuario")
        .setDescription("Quem você quer abraçar")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const target = interaction.options.getUser("usuario");
      const gif = await getGif();

      const embed = new EmbedBuilder()
        .setColor(0xFF85A1)
        .setTitle(`${emoji} Abraço`)
        .setDescription(`<@${interaction.user.id}> abraçou <@${target.id}>!`)
        .setImage(gif || "https://media.tenor.com/ZJ7fGICF0yAAAAAC/anime-hug.gif");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`hug|${interaction.user.id}|${target.id}`)
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
          content: "❌ Erro no comando hug",
          flags: 64,
        });
      } else {
        await interaction.reply({
          content: "❌ Erro no comando hug",
          flags: 64,
        });
      }
    }
  },

  async handleButton(interaction) {
    if (!interaction.customId.startsWith("hug|")) return;

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
        .setColor(0xFF85A1)
        .setTitle(`${emoji} Abraço retribuído`)
        .setDescription(`<@${interaction.user.id}> retribuiu o abraço de <@${authorId}>!`)
        .setImage(gif || "https://media.tenor.com/ZJ7fGICF0yAAAAAC/anime-hug.gif");

      await interaction.reply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
    }
  },
};
