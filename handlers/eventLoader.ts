import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "discord.js";
import type { Logger } from "../types/logger";

const logger = require("../utils/logger") as Logger;

interface EventDefinition {
  name: string;
  once?: boolean;
  execute(...args: unknown[]): unknown;
}

function isEventDefinition(value: unknown): value is EventDefinition {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Partial<EventDefinition>;
  return typeof event.name === "string" && typeof event.execute === "function";
}

export class EventLoader {
  private readonly loadedEvents = new Set<string>();

  constructor(
    private readonly client: Client,
    private readonly eventsDirectory = join(__dirname, "../events"),
  ) {}

  load(): number {
    const files = readdirSync(this.eventsDirectory)
      .filter(file => file.endsWith(".js"))
      .sort((left, right) => left.localeCompare(right));
    let loaded = 0;

    for (const file of files) {
      const eventPath = join(this.eventsDirectory, file);
      const definition: unknown = require(eventPath);
      if (!isEventDefinition(definition)) {
        throw new Error(`Evento inválido em ${file}: esperado { name, execute }.`);
      }
      if (this.loadedEvents.has(definition.name)) {
        throw new Error(`Evento duplicado: ${definition.name}.`);
      }

      const listener = (...args: unknown[]): void => {
        Promise.resolve(definition.execute(...args, this.client)).catch(error => {
          logger.error(`Falha no evento ${definition.name}`, error);
        });
      };

      if (definition.once) this.client.once(definition.name, listener);
      else this.client.on(definition.name, listener);
      this.loadedEvents.add(definition.name);
      loaded += 1;
    }

    logger.info(`Eventos carregados (${loaded})`);
    return loaded;
  }
}
