const logger = require("../utils/logger");
const { buildErrorEmbed } = require("../utils/cookieViews");
const { hasAccess } = require("../utils/permissions");

async function reportInteractionError(interaction, context, error) {
  logger.error(context, error, {
    user: interaction.user?.id,
    guild: interaction.guildId,
    customId: interaction.customId,
  });

  const payload = {
    embeds: [buildErrorEmbed(
      interaction,
      "\u274C Erro ao executar ação",
      "Não foi possível concluir essa ação. Tente novamente em alguns instantes."
    )],
    flags: 64,
  };

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (responseError) {
    logger.error("Falha ao responder erro de interação", responseError, {
      user: interaction.user?.id,
      guild: interaction.guildId,
      customId: interaction.customId,
    });
  }
}

module.exports = {
  name: "interactionCreate",

  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        if (command.access && !(await hasAccess(interaction, command.access))) {
          return interaction.reply({
            content: "Você não tem permissão para usar este comando.",
            flags: 64,
          });
        }

        logger.debug("Comando usado", {
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

        return reportInteractionError(
          interaction,
          `Erro ao executar /${interaction.commandName}`,
          err
        );
      }
    }

    if (interaction.isButton()) {
      const name = interaction.customId.split("|")[0];
      const command = client.commands.get(name);

      if (!command?.handleButton) return;

      try {
        await command.handleButton(interaction, client);
      } catch (err) {
        await reportInteractionError(interaction, `Erro ao processar botao ${interaction.customId}`, err);
      }
    }

    if (interaction.isStringSelectMenu()) {
      const name = interaction.customId.split("|")[0];
      const command = client.commands.get(name);

      if (!command?.handleSelect) return;

      try {
        await command.handleSelect(interaction, client);
      } catch (err) {
        await reportInteractionError(interaction, `Erro ao processar menu ${interaction.customId}`, err);
      }
    }

    if (interaction.isModalSubmit()) {
      const name = interaction.customId.split("|")[0];
      const command = client.commands.get(name);

      if (!command?.handleModal) return;

      try {
        await command.handleModal(interaction, client);
      } catch (err) {
        await reportInteractionError(interaction, `Erro ao processar modal ${interaction.customId}`, err);
      }
    }
  },
};
