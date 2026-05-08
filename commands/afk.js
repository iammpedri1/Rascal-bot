const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const { removeAfk, setAfk } = require("../utils/afkStore");

function afkEmbed(interaction, title, description, color) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
    .setTimestamp();
}

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
        embeds: [
          afkEmbed(
            interaction,
            `${emoji.clock} AFK ativado`,
            [
              `${interaction.user}, seu status AFK foi ativado.`,
              `${emoji.ticket} **Motivo:** ${afk.reason}`,
              `${emoji.clock} **Desde:** <t:${Math.floor(afk.createdAt / 1000)}:R>`,
            ].join("\n"),
            0xf5a623
          ),
        ],
      });
    }

    if (subcommand === "remove") {
      const removed = removeAfk(interaction.guildId, interaction.user.id);

      return interaction.reply({
        embeds: [
          afkEmbed(
            interaction,
            `${emoji.correct} AFK removido`,
            removed
              ? `${interaction.user}, seu status AFK foi removido.`
              : `${interaction.user}, voc\u00ea n\u00e3o estava AFK.`,
            0x57f287
          ),
        ],
        flags: 64,
      });
    }

    return interaction.reply({ content: "Subcomando desconhecido.", flags: 64 });
  },
};
