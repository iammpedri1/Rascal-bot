import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { CommandDefinition } from "../types/command";
import type { RascalClient } from "../core/RascalClient";
import type { Logger } from "../types/logger";
const logger = require("../utils/logger") as Logger;

function isCommandDefinition(value: unknown): value is CommandDefinition {
  if (typeof value !== "object" || value === null) return false;
  const command = value as Partial<CommandDefinition>;
  return Boolean(
    command.data &&
    typeof command.data.name === "string" &&
    typeof command.data.toJSON === "function" &&
    typeof command.execute === "function",
  );
}

/** Discovers compiled command modules and exposes a typed registry to the client. */
export class CommandHandler {
  constructor(
    private readonly client: RascalClient,
    private readonly commandsDirectory = join(__dirname, "../commands"),
  ) {}

  static discover(commandsDirectory = join(__dirname, "../commands")): CommandDefinition[] {
    const files = readdirSync(commandsDirectory)
      .filter((file) => file.endsWith(".js"))
      .sort((left, right) => left.localeCompare(right));
    const commands: CommandDefinition[] = [];

    for (const file of files) {
      try {
        const exported: unknown = require(join(commandsDirectory, file));
        if (isCommandDefinition(exported)) commands.push(exported);
        else logger.warn(`Ignorando comando inválido: ${file}`);
      } catch (error) {
        logger.error(`Falha ao carregar comando ${file}`, error);
      }
    }

    return commands;
  }

  load(): number {
    let loaded = 0;
    for (const command of CommandHandler.discover(this.commandsDirectory)) {
      if (this.client.commands.has(command.data.name)) {
        logger.warn(`Comando duplicado ignorado: /${command.data.name}`);
        continue;
      }

      this.client.commands.set(command.data.name, command);
      loaded += 1;
      logger.debug(`Comando carregado: /${command.data.name}`);
    }

    logger.info(`Handler de comandos pronto (${loaded} comandos)`);
    return loaded;
  }
}
