const { SlashCommandBuilder } = require("discord.js");

const { giveRep } = require("../utils/cookieEconomy");
const {
  buildErrorEmbed,
  buildContext,
  buildRepEmbed,
  buildSimpleCooldownEmbed,
} = require("../utils/cookieViews");

module.exports = {
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("rep")
    .setDescription("Envie reputacao para outro usuario a cada 24 horas")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuario que vai receber reputacao")
        .setRequired(true)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser("usuario");

    if (target.bot) {
      return interaction.reply({
        embeds: [buildErrorEmbed(interaction, "\u2764\uFE0F REP BLOQUEADO", "Voce nao pode enviar reputacao para bots.")],
        flags: 64,
      });
    }

    const result = giveRep(interaction.user, target, buildContext(interaction));

    if (!result.ok && result.reason === "self") {
      return interaction.reply({
        embeds: [buildErrorEmbed(interaction, "\u2764\uFE0F REP BLOQUEADO", "Voce nao pode dar rep para voce mesmo.")],
        flags: 64,
      });
    }

    if (!result.ok && result.reason === "cooldown") {
      return interaction.reply({
        embeds: [buildSimpleCooldownEmbed(interaction, "\u2764\uFE0F REP EM COOLDOWN", result)],
        flags: 64,
      });
    }

    return interaction.reply({
      embeds: [buildRepEmbed(interaction, target, result)],
    });
  },
};
