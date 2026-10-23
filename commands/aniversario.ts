const { SlashCommandBuilder } = require("discord.js");

const emoji = require("../utils/emojis");
const {
  formatBirthday,
  getBirthday,
  isValidBirthday,
  removeBirthday,
  setBirthday,
} = require("../utils/birthdays");

const monthChoices = [
  ["Janeiro", 1],
  ["Fevereiro", 2],
  ["Março", 3],
  ["Abril", 4],
  ["Maio", 5],
  ["Junho", 6],
  ["Julho", 7],
  ["Agosto", 8],
  ["Setembro", 9],
  ["Outubro", 10],
  ["Novembro", 11],
  ["Dezembro", 12],
].map(([name, value]) => ({ name, value }));

module.exports = {
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("aniversario")
    .setDescription("Guarda seu aniversário para o bot te dar parabéns")
    .addSubcommand(subcommand =>
      subcommand
        .setName("definir")
        .setDescription("Define ou atualiza seu aniversário")
        .addIntegerOption(option =>
          option
            .setName("dia")
            .setDescription("Dia do seu aniversário")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(31)
        )
        .addIntegerOption(option =>
          option
            .setName("mes")
            .setDescription("Mês do seu aniversário")
            .setRequired(true)
            .addChoices(...monthChoices)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("ver")
        .setDescription("Mostra o aniversário salvo")
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Usuário para consultar")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("remover")
        .setDescription("Remove seu aniversário salvo")
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: `${emoji.crossed} | **Use esse comando em um servidor.**`,
        flags: 64,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "definir") {
      const day = interaction.options.getInteger("dia");
      const month = interaction.options.getInteger("mes");

      if (!isValidBirthday(day, month)) {
        return interaction.reply({
          content: `${emoji.crossed} | **Data inválida. Confira o dia e o mês.**`,
          flags: 64,
        });
      }

      const birthday = setBirthday({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        channelId: interaction.channelId,
        day,
        month,
      });

      return interaction.reply({
        content: [
          `${emoji.correct} | **Aniversário salvo:** ${formatBirthday(birthday.day, birthday.month)}.`,
          `${emoji.sino} Eu vou te dar parabéns neste canal quando chegar o dia.`,
        ].join("\n"),
        flags: 64,
      });
    }

    if (subcommand === "ver") {
      const user = interaction.options.getUser("usuario") || interaction.user;
      const birthday = getBirthday(interaction.guildId, user.id);

      if (!birthday) {
        return interaction.reply({
          content: `${emoji.peepSad} | **${user.username} ainda não salvou um aniversário.**`,
          flags: 64,
        });
      }

      return interaction.reply({
        content: `${emoji.gift} | **Aniversário de ${user.username}:** ${formatBirthday(birthday.day, birthday.month)}.`,
        flags: 64,
      });
    }

    if (subcommand === "remover") {
      const removed = removeBirthday(interaction.guildId, interaction.user.id);

      return interaction.reply({
        content: removed
          ? `${emoji.correct} | **Removi seu aniversário salvo.**`
          : `${emoji.peepSad} | **Você não tinha aniversário salvo.**`,
        flags: 64,
      });
    }

    return interaction.reply({
      content: `${emoji.crossed} | **Subcomando desconhecido.**`,
      flags: 64,
    });
  },
};
