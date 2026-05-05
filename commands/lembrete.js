const { SlashCommandBuilder } = require("discord.js");

const {
  buildScheduledEmbed,
  createReminder,
} = require("../utils/reminders");

const units = {
  minutos: 60 * 1000,
  horas: 60 * 60 * 1000,
  dias: 24 * 60 * 60 * 1000,
};

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("lembrete")
    .setDescription("Agenda um lembrete e te notifica quando chegar a hora")
    .addIntegerOption(option =>
      option
        .setName("tempo")
        .setDescription("Quantidade de tempo")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(30)
    )
    .addStringOption(option =>
      option
        .setName("unidade")
        .setDescription("Unidade de tempo")
        .setRequired(true)
        .addChoices(
          { name: "Minutos", value: "minutos" },
          { name: "Horas", value: "horas" },
          { name: "Dias", value: "dias" }
        )
    )
    .addStringOption(option =>
      option
        .setName("mensagem")
        .setDescription("O que eu devo te lembrar")
        .setRequired(true)
        .setMaxLength(300)
    ),

  async execute(interaction) {
    const time = interaction.options.getInteger("tempo");
    const unit = interaction.options.getString("unidade");
    const message = interaction.options.getString("mensagem");
    const dueAt = Date.now() + time * units[unit];
    const reminder = createReminder({
      userId: interaction.user.id,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      message,
      dueAt,
    });

    return interaction.reply({
      embeds: [buildScheduledEmbed(interaction.user, reminder)],
      flags: 64,
    });
  },
};
