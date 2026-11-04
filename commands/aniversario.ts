import { defineCommand } from "../types/command";
const { SlashCommandBuilder } = require("discord.js") as typeof import("discord.js");

const emoji = require("../utils/emojis");
const {
  formatBirthday,
  getBirthday,
  isValidBirthday,
  removeBirthday,
  setBirthday,
} = require("../utils/birthdays");

const monthChoices = [
  { name: "Janeiro", value: 1 },
  { name: "Fevereiro", value: 2 },
  { name: "Março", value: 3 },
  { name: "Abril", value: 4 },
  { name: "Maio", value: 5 },
  { name: "Junho", value: 6 },
  { name: "Julho", value: 7 },
  { name: "Agosto", value: 8 },
  { name: "Setembro", value: 9 },
  { name: "Outubro", value: 10 },
  { name: "Novembro", value: 11 },
  { name: "Dezembro", value: 12 },
];

module.exports = defineCommand({
  category: "utility",

  data: new SlashCommandBuilder()
    .setName("aniversario")
    .setDescription("Registra sua data de nascimento para celebrações futuras")
    .addSubcommand(subcommand =>
      subcommand
        .setName("definir")
        .setDescription("Registra ou atualiza sua data de nascimento")
        .addIntegerOption(option =>
          option
            .setName("dia")
            .setDescription("Dia do seu nascimento")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(31)
        )
        .addIntegerOption(option =>
          option
            .setName("mes")
            .setDescription("Mês do seu nascimento")
            .setRequired(true)
            .addChoices(...monthChoices)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("ver")
        .setDescription("Exibe a data de nascimento registrada")
        .addUserOption(option =>
          option
            .setName("usuario")
            .setDescription("Usuário para consulta")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("remover")
        .setDescription("Remove o registro de sua data de nascimento")
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: `${emoji.crossed} | **Por favor, utilize este comando dentro de um servidor.**`,
        flags: 64,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "definir") {
      const day = interaction.options.getInteger("dia");
      const month = interaction.options.getInteger("mes");

      if (!isValidBirthday(day, month)) {
        return interaction.reply({
          content: `${emoji.crossed} | **Data inválida. Por favor, verifique o dia e o mês informados.**`,
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
          `${emoji.correct} | **Data de nascimento registrada:** ${formatBirthday(birthday.day, birthday.month)}.`,
          `${emoji.sino} As felicitações serão enviadas neste canal na data correspondente.`,
        ].join("\n"),
        flags: 64,
      });
    }

    if (subcommand === "ver") {
      const user = interaction.options.getUser("usuario") || interaction.user;
      const birthday = getBirthday(interaction.guildId, user.id);

      if (!birthday) {
        return interaction.reply({
          content: `${emoji.peepSad} | **${user.username} ainda não possui uma data de nascimento registrada.**`,
          flags: 64,
        });
      }

      return interaction.reply({
        content: `${emoji.calendar} | **Aniversário de ${user.username}:** ${formatBirthday(birthday.day, birthday.month)}.`,
        flags: 64,
      });
    }

    if (subcommand === "remover") {
      const removed = removeBirthday(interaction.guildId, interaction.user.id);

      return interaction.reply({
        content: removed
          ? `${emoji.correct} | **O registro da sua data de nascimento foi removido.**`
          : `${emoji.peepSad} | **Você não possuía uma data de nascimento registrada.**`,
        flags: 64,
      });
    }

    return interaction.reply({
      content: `${emoji.crossed} | **Subcomando desconhecido.**`,
      flags: 64,
    });
  },
});
