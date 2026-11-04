import { defineCommand } from "../types/command";
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js") as typeof import("discord.js");

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

module.exports = defineCommand({
  category: "action",

  data: new SlashCommandBuilder()
    .setName("hug")
    .setDescription("Envia um abraço carinhoso a alguém")
    .addUserOption(opt =>
      opt.setName("usuario")
        .setDescription("Usuário que deseja abraçar")
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
        .setDescription(`<@${interaction.user.id}> enviou um abraço para <@${target.id}>!`)
        .setImage(gif || "https://media.tenor.com/ZJ7fGICF0yAAAAAC/anime-hug.gif");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`hug|${interaction.user.id}|${target.id}`)
          .setLabel("Retribuir Gesto")
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
          content: "❌ Ocorreu um erro ao processar o comando hug.",
          flags: 64,
        });
      } else {
        await interaction.reply({
          content: "❌ Ocorreu um erro ao processar o comando hug.",
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
          content: "❌ Apenas o destinatário do gesto pode retribuí-lo.",
          flags: 64,
        });
      }

      const gif = await getGif();

      const embed = new EmbedBuilder()
        .setColor(0xFF85A1)
        .setTitle(`${emoji} Gesto Retribuído`)
        .setDescription(`<@${interaction.user.id}> retribuiu o abraço de <@${authorId}>!`)
        .setImage(gif || "https://media.tenor.com/ZJ7fGICF0yAAAAAC/anime-hug.gif");

      await interaction.reply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
    }
  },
});
