import { defineCommand } from "../types/command";
const { SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");

const emoji = require("../utils/emojis");
const { removeAfk, setAfk } = require("../utils/afkStore");

const REASON_EMOJI = "<:1000106078:1499822832757113024>";

module.exports = defineCommand({
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Gerencia seu estado de ausência (AFK)")
    .addSubcommand(subcommand =>
      subcommand
        .setName("set")
        .setDescription("Define seu estado como ausente")
        .addStringOption(option =>
          option
            .setName("motivo")
            .setDescription("Motivo da ausência")
            .setRequired(false)
            .setMaxLength(200)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("remove")
        .setDescription("Remove seu estado de ausência")
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Este comando deve ser utilizado dentro de um servidor.", flags: 64 });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
      const reason = interaction.options.getString("motivo") || "Nenhum motivo informado.";
      const afk = setAfk(interaction.guildId, interaction.user.id, reason);

      return interaction.reply({
        content: [
          `${emoji.clock} ${interaction.user}, seu estado de ausência foi ativado.`,
          `${REASON_EMOJI} Motivo: **${afk.reason}**`,
          `${emoji.sino} Desde: <t:${Math.floor(afk.createdAt / 1000)}:R>`,
        ].join("\n"),
      });
    }

    if (subcommand === "remove") {
      const removed = removeAfk(interaction.guildId, interaction.user.id);

      return interaction.reply({
        content: removed
          ? `${emoji.correct} ${interaction.user}, seu estado de ausência foi removido.`
          : `${emoji.peepSad} ${interaction.user}, você não estava em estado de ausência.`,
        flags: 64,
      });
    }

    return interaction.reply({ content: "Subcomando desconhecido.", flags: 64 });
  },
});
