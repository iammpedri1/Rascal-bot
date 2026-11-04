import { defineCommand } from "../types/command";
const { SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");

const { giveRep } = require("../utils/cookieEconomy");
const emoji = require("../utils/emojis");
const {
  buildContext,
  buildRepEmbed,
  buildSimpleCooldownEmbed,
} = require("../utils/cookieViews");

module.exports = defineCommand({
  category: "economy",

  data: new SlashCommandBuilder()
    .setName("rep")
    .setDescription("Atribua um ponto de reputação a um membro da comunidade")
    .addUserOption(option =>
      option
        .setName("usuario")
        .setDescription("Usuário que receberá a reputação")
        .setRequired(true)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser("usuario");

    if (target.bot) {
      return interaction.reply({
        content: `${emoji.crossed} | **Não é possível atribuir reputação a perfis robóticos.**`,
        flags: 64,
      });
    }

    const result = giveRep(interaction.user, target, buildContext(interaction));

    if (!result.ok && result.reason === "self") {
      return interaction.reply({
        content: `${emoji.crossed} | **Você não pode atribuir reputação ao próprio perfil.**`,
        flags: 64,
      });
    }

    if (!result.ok && result.reason === "cooldown") {
      return interaction.reply({
        embeds: [buildSimpleCooldownEmbed(interaction, "💌 Reputação em Período de Espera", result)],
        flags: 64,
      });
    }

    return interaction.reply({
      embeds: [buildRepEmbed(interaction, target, result)],
    });
  },
});
