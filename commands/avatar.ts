import { defineCommand } from "../types/command";
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js") as typeof import("discord.js");

function randomColor() {
  return Math.floor(Math.random() * 0xffffff);
}

module.exports = defineCommand({
  category: "user",

  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Exibe a imagem de perfil de um usuário")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário para consulta")
        .setRequired(true)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("usuario");
    const avatar = user.displayAvatarURL({ size: 4096 });

    const embed = new EmbedBuilder()
      .setColor(randomColor())
      .setDescription(`Imagem de perfil de ${user}`)
      .setImage(avatar);

    await interaction.reply({ embeds: [embed] });
  },
});
