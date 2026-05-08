const logger = require("../utils/logger");
const { buildErrorEmbed } = require("../utils/cookieViews");

module.exports = {
  name: "interactionCreate",

  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        logger.info("Comando usado", {
          command: interaction.commandName,
          user: interaction.user.id,
          guild: interaction.guildId,
        });

        await command.execute(interaction, client);
      } catch (err) {
        logger.error(`Erro ao executar /${interaction.commandName}`, err, {
          user: interaction.user.id,
          guild: interaction.guildId,
        });

        const payload = {
          embeds: [buildErrorEmbed(
            interaction,
            "\u274C Erro ao executar comando",
            "Algo deu errado ao executar esse comando. Tente novamente em alguns instantes."
          )],
          flags: 64,
        };

        if (interaction.deferred || interaction.replied) {
          return interaction.followUp(payload).catch(() => {});
        }

        return interaction.reply(payload).catch(() => {});
      }
    }

    if (interaction.isButton()) {
      const name = interaction.customId.split("|")[0];
      const command = client.commands.get(name);

      if (!command?.handleButton) return;

      try {
        await command.handleButton(interaction, client);
      } catch (err) {
        logger.error(`Erro ao processar botao ${interaction.customId}`, err, {
          user: interaction.user.id,
          guild: interaction.guildId,
        });
      }
    }

    if (interaction.isStringSelectMenu()) {
      const name = interaction.customId.split("|")[0];
      const command = client.commands.get(name);

      if (!command?.handleSelect) return;

      try {
        await command.handleSelect(interaction, client);
      } catch (err) {
        logger.error(`Erro ao processar menu ${interaction.customId}`, err, {
          user: interaction.user.id,
          guild: interaction.guildId,
        });
      }
    }

    if (interaction.isModalSubmit()) {
      const name = interaction.customId.split("|")[0];
      const command = client.commands.get(name);

      if (!command?.handleModal) return;

      try {
        await command.handleModal(interaction, client);
      } catch (err) {
        logger.error(`Erro ao processar modal ${interaction.customId}`, err, {
          user: interaction.user.id,
          guild: interaction.guildId,
        });
      }
    }
  },
};
