import {
  Client,
  Collection,
  GatewayIntentBits,
  Options,
  type ClientOptions,
} from "discord.js";
import { CommandHandler } from "../handlers/commandHandler";
import { EventLoader } from "../handlers/eventLoader";
import type { CommandDefinition } from "../types/command";
import type { Logger } from "../types/logger";

const logger = require("../utils/logger") as Logger;
const { latestDiscordCommand } = require("../utils/discordDiagnostics") as typeof import("../utils/discordDiagnostics");

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

  /**
   * Inicializa handlers e conecta ao Discord.
   * Retorna a própria instância para permitir chaining.
   */
  async start(token: string): Promise<this> {
    if (this.initialized) {
      throw new Error("[RascalClient] O cliente já foi inicializado.");
    }
    if (!token) {
      throw new Error("[RascalClient] Token não fornecido.");
    }

    try {
      // Carrega handlers (podem lançar erro se algum arquivo estiver corrompido)
      new CommandHandler(this).load();
      new EventLoader(this).load();
      // Efetua o login
      await this.login(token);
      
      this.initialized = true;
      logger.info("RascalClient inicializado e conectado.");
      return this;
    } catch (error) {
      // Se algo falhar, reseta o estado para permitir tentar de novo, e repassa o erro
      this.initialized = false;
      logger.error("[RascalClient] Falha fatal ao iniciar o bot", error);
      throw error;
    }
  }

  /** Desliga o bot de forma segura (aguardando o gateway). */
  async shutdown(): Promise<void> {
    try {
      await this.destroy();
      this.commands.clear();
      this.initialized = false;
      logger.info("RascalClient desligado com sucesso.");
    } catch (error) {
      logger.error("[RascalClient] Erro ao desligar", error);
    }
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
    
    this.on("rateLimit", (info) => {
      logger.warn("Rate limit do Discord acionado", {
        route: info.route,
        timeout: info.timeout,
        global: info.global,
        command: latestDiscordCommand() ?? "não identificado",
      });
    });
  }
}