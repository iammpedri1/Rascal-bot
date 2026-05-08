const { SlashCommandBuilder } = require("discord.js");

const { work } = require("../utils/cookieEconomy");
const {
  buildContext,
  buildWorkCooldownEmbed,
  buildWorkEmbed,
  pick,
  workFailReasons,
} = require("../utils/cookieViews");

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("trabalhar")
    .setDescription("Trabalhe na firma e tente ganhar cookies a cada 8 horas"),

  async execute(interaction) {
    const result = work(interaction.user, {
      ...buildContext(interaction),
      reason: pick(workFailReasons),
    });
    const embed = result.worked
      ? buildWorkEmbed(interaction, result)
      : buildWorkCooldownEmbed(interaction, result);

    return interaction.reply({ embeds: [embed] });
  },
};
