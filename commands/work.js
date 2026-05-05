const { SlashCommandBuilder } = require("discord.js");

const { work } = require("../utils/cookieEconomy");
const {
  buildContext,
  buildWorkCooldownEmbed,
  buildWorkEmbed,
} = require("../utils/cookieViews");

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription("Trabalhe na firma e ganhe cookies a cada 3 horas"),

  async execute(interaction) {
    const result = work(interaction.user, buildContext(interaction));
    const embed = result.worked
      ? buildWorkEmbed(interaction.user, result)
      : buildWorkCooldownEmbed(interaction.user, result);

    return interaction.reply({ embeds: [embed] });
  },
};
