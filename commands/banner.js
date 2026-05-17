const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function randomColor() {
  return Math.floor(Math.random() * 0xffffff);
}

module.exports = {
  category: "user",

  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Mostra o banner de um usuário")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Usuário")
        .setRequired(true)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("user");
    const fetchedUser = await user.fetch({ force: true });
    const banner = fetchedUser.bannerURL({ size: 4096 });

    const embed = new EmbedBuilder()
      .setColor(randomColor())
      .setDescription(banner ? `Banner do ${user}` : `${user} não possui banner`);

    if (banner) embed.setImage(banner);

    await interaction.reply({ embeds: [embed] });
  },
};
