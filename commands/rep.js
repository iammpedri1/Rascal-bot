const { SlashCommandBuilder } = require("discord.js");

const { giveRep } = require("../utils/cookieEconomy");
const emoji = require("../utils/emojis");
const {
  buildContext,
  buildRepEmbed,
  buildSimpleCooldownEmbed,
} = require("../utils/cookieViews");

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("rep")
    .setDescription("Envie reputação para outro usuário a cada 12 horas")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário que vai receber reputação")
        .setRequired(true)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser("usuario");

    if (target.bot) {
      return interaction.reply({
        content: `${emoji.crossed} | **Você não pode dar rep para bots.**`,
        flags: 64,
      });
    }

    const result = giveRep(interaction.user, target, buildContext(interaction));

    if (!result.ok && result.reason === "self") {
      return interaction.reply({
        content: `${emoji.crossed} | **Você não pode dar rep para si mesmo.**`,
        flags: 64,
      });
    }

    if (!result.ok && result.reason === "cooldown") {
      return interaction.reply({
        embeds: [buildSimpleCooldownEmbed(interaction, "💌 Rep em cooldown", result)],
        flags: 64,
      });
    }

    return interaction.reply({
      embeds: [buildRepEmbed(interaction, target, result)],
    });
  },
};
