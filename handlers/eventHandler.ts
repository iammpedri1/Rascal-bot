import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Events, type ClientEvents } from "discord.js";
import type { ClientEventName, EventDefinition } from "../types/event";
import type { RascalClient } from "../core/RascalClient";
import type { Logger } from "../types/logger";
const logger = require("../utils/logger") as Logger;
const validEventNames = new Set<string>(Object.values(Events));

function isEventDefinition(value: unknown): value is EventDefinition<ClientEventName> {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Partial<EventDefinition<ClientEventName>>;
  return typeof event.name === "string" &&
    validEventNames.has(event.name) &&
    typeof event.execute === "function";
}

/** Discovers event modules and attaches guarded listeners to the client. */
export class EventHandler {
  constructor(
    private readonly client: RascalClient,
    private readonly eventsDirectory = join(__dirname, "../events"),
  ) {}

  load(): number {
    const files = readdirSync(this.eventsDirectory)
      .filter((file) => file.endsWith(".js"))
      .sort((left, right) => left.localeCompare(right));

    let loaded = 0;
    for (const file of files) {
      try {
        const exported: unknown = require(join(this.eventsDirectory, file));
        if (!isEventDefinition(exported)) {
          logger.warn(`Ignorando evento inválido: ${file}`);
          continue;
        }

        this.register(exported);
        loaded += 1;
        logger.debug(`Evento carregado: ${exported.name}`);
      } catch (error) {
        logger.error(`Falha ao carregar evento ${file}`, error);
      }
    }

    logger.info(`Handler de eventos pronto (${loaded} eventos)`);
    return loaded;
  }

  private register<K extends ClientEventName>(event: EventDefinition<K>): void {
    const listener = (...args: ClientEvents[K]): void => {
      void this.run(event, args);
    };

    if (event.once) this.client.once(event.name, listener);
    else this.client.on(event.name, listener);
  }

  private async run<K extends ClientEventName>(
    event: EventDefinition<K>,
    args: ClientEvents[K],
  ): Promise<void> {
    try {
      await event.execute(...args, this.client);
    } catch (error) {
      logger.error(`Erro no evento ${event.name}`, error);
    }
  }
}
