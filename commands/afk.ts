const { SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { removeAfk, setAfk } = require("../utils/afkStore");

const REASON_EMOJI = "<:1000106078:1499822832757113024>";

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Gerencia seu status AFK")
    .addSubcommand(subcommand =>
      subcommand
        .setName("set")
        .setDescription("Ativa seu status AFK")
        .addStringOption(option =>
          option
            .setName("motivo")
            .setDescription("Motivo do AFK")
            .setRequired(false)
            .setMaxLength(200)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("remove")
        .setDescription("Remove seu status AFK")
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "Use esse comando em um servidor.", flags: 64 });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set") {
      const reason = interaction.options.getString("motivo") || "Sem motivo informado.";
      const afk = setAfk(interaction.guildId, interaction.user.id, reason);

      return interaction.reply({
        content: [
          `${emoji.clock} ${interaction.user}, seu AFK foi ativado.`,
          `${REASON_EMOJI} Motivo: **${afk.reason}**`,
          `${emoji.sino} Desde: <t:${Math.floor(afk.createdAt / 1000)}:R>`,
        ].join("\n"),
      });
    }

    if (subcommand === "remove") {
      const removed = removeAfk(interaction.guildId, interaction.user.id);

      return interaction.reply({
        content: removed
          ? `${emoji.correct} ${interaction.user}, seu AFK foi removido.`
          : `${emoji.peepSad} ${interaction.user}, voc\u00ea n\u00e3o estava AFK.`,
        flags: 64,
      });
    }

    return interaction.reply({ content: "Subcomando desconhecido.", flags: 64 });
  },
};
