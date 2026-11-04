import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Interaction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import type { RascalClient } from "../core/RascalClient";
import { withBrandedResponses } from "../core/InteractionResponseFormatter";
import type {
  BotClient,
  CommandAccess,
  CommandButtonInteraction,
  CommandChatInputInteraction,
  CommandModalInteraction,
  CommandSelectInteraction,
} from "../types/command";
import type { Logger } from "../types/logger";
const { isPrimaryGuild } = require("../utils/primaryGuild") as typeof import("../utils/primaryGuild");
const blackMarket = require("../utils/blackMarket") as typeof import("../utils/blackMarket");
const { buildErrorEmbed } = require("../utils/cookieViews") as {
  buildErrorEmbed(source: RepliableInteraction, title: string, message: string): EmbedBuilder;
};
const { hasAccess } = require("../utils/permissions") as {
  hasAccess(interaction: ChatInputCommandInteraction, access: CommandAccess): Promise<boolean>;
};
const { handleButton: handleCooldownNotification } = require("../utils/cooldownNotifications") as {
  handleButton(interaction: ButtonInteraction): Promise<unknown>;
};
const { createRateLimiter } = require("../utils/interactionRateLimit") as typeof import("../utils/interactionRateLimit");
const logger = require("../utils/logger") as Logger;
const { recordDiscordCommand } = require("../utils/discordDiagnostics") as typeof import("../utils/discordDiagnostics");

// Limite generoso: barra apenas flood de comandos, sem atrapalhar o uso normal.
const commandRateLimiter = createRateLimiter({ max: 10, windowMs: 10_000 });

type RepliableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ModalSubmitInteraction;

function discordErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = error.code;
  return typeof code === "number" ? code : undefined;
}

function interactionCustomId(interaction: Interaction): string | undefined {
  return "customId" in interaction ? interaction.customId : undefined;
}

async function reportInteractionError(
  interaction: RepliableInteraction,
  client: RascalClient,
  context: string,
  error: unknown,
): Promise<void> {
  const customId = interactionCustomId(interaction);
  logger.error(context, error, {
    user: interaction.user.id,
    guild: interaction.guildId,
    ...(customId ? { customId } : {}),
  });

  if ([10062, 10015].includes(discordErrorCode(error) ?? 0)) return;

  const response = withBrandedResponses(interaction, client);
  const payload = {
    embeds: [buildErrorEmbed(
      interaction,
      "❌ Erro ao executar ação",
      "Não foi possível concluir essa ação. Tente novamente em alguns instantes.",
    )],
    flags: 64,
  };

  try {
    if (interaction.deferred || interaction.replied) await response.followUp(payload);
    else await response.reply(payload);
  } catch (responseError) {
    if ([10062, 10015].includes(discordErrorCode(responseError) ?? 0)) return;
    logger.error("Falha ao responder erro de interação", responseError, {
      user: interaction.user.id,
      guild: interaction.guildId,
      ...(customId ? { customId } : {}),
    });
  }
}

async function dispatchCommand(
  interaction: ChatInputCommandInteraction,
  client: RascalClient,
): Promise<void> {
  const command = client.commands.get(interaction.commandName);
  const response = withBrandedResponses(interaction, client);

  if (!command) {
    await response.reply({
      content: "Esse comando não está mais disponível. Atualize os comandos do bot e tente novamente.",
      flags: 64,
    }).catch((error: unknown) => {
      if (![10062, 10015].includes(discordErrorCode(error) ?? 0)) {
        logger.error("Falha ao informar comando indisponível", error);
      }
    });
    return;
  }

  if (command.category === "economy" && interaction.commandName !== "fianca") {
    const prison = blackMarket.getActivePrisonStatus(interaction.user.id);
    if (prison) {
      await response.reply({
        embeds: [buildErrorEmbed(
          interaction,
          "🚓 Você está na prisão",
          `Você poderá sair <t:${Math.floor(prison.releaseAt / 1000)}:R>, ou pagar **${prison.bailAmount.toLocaleString("pt-BR")} cookies** com **/fianca**.`,
        )],
        flags: 64,
      });
      return;
    }
  }

  try {
    if (command.access && !(await hasAccess(interaction, command.access))) {
      await response.reply({
        content: "Você não tem permissão para usar este comando.",
        flags: 64,
      });
      return;
    }

    logger.debug("Comando usado", {
      command: interaction.commandName,
      user: interaction.user.id,
      guild: interaction.guildId,
    });
    recordDiscordCommand(interaction.commandName);

    await command.execute(response as unknown as CommandChatInputInteraction, client as BotClient);
  } catch (error) {
    await reportInteractionError(
      interaction,
      client,
      `Erro ao executar /${interaction.commandName}`,
      error,
    );
  }
}

async function dispatchComponent(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  client: RascalClient,
): Promise<void> {
  const customId = interaction.customId;
  const commandName = customId.split("|")[0];
  const command = client.commands.get(commandName);

  if (command?.category === "economy" && commandName !== "fianca") {
    const prison = blackMarket.getActivePrisonStatus(interaction.user.id);
    if (prison) {
      await withBrandedResponses(interaction, client).reply({
        embeds: [buildErrorEmbed(
          interaction,
          "🚓 Você está na prisão",
          `Você poderá sair <t:${Math.floor(prison.releaseAt / 1000)}:R>, ou pagar **${prison.bailAmount.toLocaleString("pt-BR")} cookies** com **/fianca**.`,
        )],
        flags: 64,
      });
      return;
    }
  }

  if (interaction.isButton()) {
    try {
      if (customId.startsWith("cooldownnotify|")) {
        await handleCooldownNotification(withBrandedResponses(interaction, client));
      } else if (command?.handleButton) {
        await command.handleButton(
          withBrandedResponses(interaction, client) as unknown as CommandButtonInteraction,
          client as BotClient,
        );
      }
    } catch (error) {
      await reportInteractionError(interaction, client, `Erro ao processar componente ${customId}`, error);
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    try {
      if (command?.handleSelect) {
        await command.handleSelect(
          withBrandedResponses(interaction, client) as unknown as CommandSelectInteraction,
          client as BotClient,
        );
      }
    } catch (error) {
      await reportInteractionError(interaction, client, `Erro ao processar componente ${customId}`, error);
    }
    return;
  }

  try {
    if (command?.handleModal) {
      await command.handleModal(
        withBrandedResponses(interaction, client) as unknown as CommandModalInteraction,
        client as BotClient,
      );
    }
  } catch (error) {
    await reportInteractionError(interaction, client, `Erro ao processar componente ${customId}`, error);
  }
}

async function enforceCommandRateLimit(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const { allowed, retryAfterMs } = commandRateLimiter.check(interaction.user.id);
  if (allowed) return true;

  await interaction.reply({
    content: `Calma lá! Você está usando comandos rápido demais. Tente novamente em ${Math.ceil(retryAfterMs / 1000)}s.`,
    flags: 64,
    allowedMentions: { repliedUser: false },
  }).catch(() => undefined);
  return false;
}

module.exports = {
  name: "interactionCreate",

  async execute(interaction: Interaction, client: RascalClient): Promise<void> {
    if (!isPrimaryGuild(interaction.guildId)) {
      if (interaction.isRepliable()) {
        await interaction.reply({
          content: "O Rascal é exclusivo do servidor configurado e só pode ser usado nele.",
          flags: 64,
          allowedMentions: { repliedUser: false },
        }).catch(() => undefined);
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      if (!(await enforceCommandRateLimit(interaction))) return;
      await dispatchCommand(interaction, client);
      return;
    }

    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      await dispatchComponent(interaction, client);
    }
  },
};
