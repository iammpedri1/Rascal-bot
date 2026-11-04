import {
  Client,
  Collection,
  GatewayIntentBits,
  Options,
  type ClientOptions,
} from "discord.js";
import { CommandHandler } from "../handlers/commandHandler";
import { EventHandler } from "../handlers/eventHandler";
import type { CommandDefinition } from "../types/command";
import type { Logger } from "../types/logger";
const logger = require("../utils/logger") as Logger;

function buildClientOptions(): ClientOptions {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ];

  if (String(process.env.DISCORD_PRESENCE_INTENT).toLowerCase() === "true") {
    intents.push(GatewayIntentBits.GuildPresences);
  }

  return {
    intents,
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 50,
      ReactionManager: 0,
      ReactionUserManager: 0,
    }),


    sweepers: {
      ...Options.DefaultSweeperSettings,
      messages: {
        interval: 600,
        lifetime: 1800,
      },
    },
  };
}

/** Main Discord client and lifecycle owner for the bot. */
export class RascalClient extends Client {
  readonly commands = new Collection<string, CommandDefinition>();
  private initialized = false;

  constructor(options: ClientOptions = buildClientOptions()) {
    super(options);
    this.attachClientDiagnostics();
  }

  async start(token: string): Promise<string> {
    if (this.initialized) throw new Error("O cliente Rascal já foi inicializado.");
    this.initialized = true;

    new CommandHandler(this).load();
    new EventHandler(this).load();

    return this.login(token);
  }

  shutdown(): void {
    this.destroy();
    this.commands.clear();
  }

  private attachClientDiagnostics(): void {
    this.on("error", (error) => logger.error("Erro do client Discord", error));
    this.on("warn", (warning) => logger.warn("Aviso do client Discord", { warning }));
    this.on("shardDisconnect", (event) => {
      logger.warn("Shard desconectada", { code: event.code, reason: event.reason });
    });
    this.on("shardReconnecting", (id) => logger.warn("Shard reconectando", { id }));
    this.on("shardResume", (id, replayedEvents) => {
      logger.info("Shard reconectada", { id, replayedEvents });
    });
  }
}
