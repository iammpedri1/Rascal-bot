import { defineCommand } from "../types/command";
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js") as typeof import("discord.js");

function randomColor() {
  return Math.floor(Math.random() * 0xffffff);
}

module.exports = defineCommand({
  category: "user",

  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Exibe o banner de perfil de um usuário")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário para consulta")
        .setRequired(true)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("usuario");
    const fetchedUser = await user.fetch(true);
    const banner = fetchedUser.bannerURL({ size: 4096 });

    const embed = new EmbedBuilder()
      .setColor(randomColor())
      .setDescription(banner ? `Banner de perfil de ${user}` : `${user} não possui um banner configurado.`);

    if (banner) embed.setImage(banner);

    await interaction.reply({ embeds: [embed] });
  },
});
