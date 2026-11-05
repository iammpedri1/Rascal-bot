import {
  Client,
  Collection,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type Interaction,
  type InteractionReplyOptions, // <--- Adicionado para corrigir o erro de tipagem
} from "discord.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import { withBrandedResponses } from "./core/InteractionResponseFormatter";

dotenv.config();

// ---------- constantes ----------
const COMMANDS_DIR = path.join(__dirname, "commands");

const ERR_INTERACTION_EXPIRED = 10062;
const ERR_INTERACTION_ACKNOWLEDGED = 40060;
const ERR_UNKNOWN_CHANNEL = 10003;
const ERR_UNKNOWN_MESSAGE = 10008;

const DEAD_INTERACTION_CODES = new Set<number>([
  ERR_INTERACTION_EXPIRED,
  ERR_INTERACTION_ACKNOWLEDGED,
  ERR_UNKNOWN_CHANNEL,
  ERR_UNKNOWN_MESSAGE,
]);

// ---------- tipos ----------
interface BotConfig {
  token: string;
  clientId: string;
  guildId: string | undefined;
}

interface BotCommand {
  data: { name: string; toJSON(): unknown };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// ---------- config ----------
function loadConfig(): BotConfig {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID || undefined;

  if (!token) throw new Error("DISCORD_TOKEN é obrigatório no .env");
  if (!clientId) throw new Error("CLIENT_ID é obrigatório no .env");

  return { token, clientId, guildId };
}

// ---------- helpers de erro ----------
function getErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const asRecord = error as { code?: number; rawError?: { code?: number } };
  return asRecord.code ?? asRecord.rawError?.code;
}

function isDeadInteractionError(error: unknown): boolean {
  const code = getErrorCode(error);
  return code !== undefined && DEAD_INTERACTION_CODES.has(code);
}

// ---------- carregamento de comandos ----------
function listCommandFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      console.error(`[loader] não foi possível ler ${dir}:`, error);
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (/\.(ts|js)$/.test(entry.name)) files.push(fullPath);
    }
  };
  walk(COMMANDS_DIR);
  return files;
}

function loadCommandFrom(filePath: string): BotCommand | undefined {
  try {
    delete require.cache[require.resolve(filePath)];
    const mod = require(filePath);
    const command = mod.default ?? mod;

    if (!command?.data || typeof command?.execute !== "function") {
      console.warn(`[loader] ${filePath} não exporta { data, execute }`);
      return undefined;
    }
    if (typeof command.data.name !== "string" || typeof command.data.toJSON !== "function") {
      console.warn(`[loader] ${filePath} tem "data" inválido`);
      return undefined;
    }
    return command as BotCommand;
  } catch (error) {
    console.error(`[loader] erro ao carregar ${filePath}:`, error);
    return undefined;
  }
}

function loadAllCommands(): BotCommand[] {
  const commands: BotCommand[] = [];
  for (const file of listCommandFiles()) {
    const command = loadCommandFrom(file);
    if (command) commands.push(command);
  }
  return commands;
}

// ---------- registro ----------
async function registerCommands(config: BotConfig, commands: BotCommand[]): Promise<void> {
  if (commands.length === 0) {
    console.warn("[register] nenhum comando válido para registrar");
    return;
  }

  const body = commands.map((command) => command.data.toJSON());
  const rest = new REST({ timeout: 30_000 }).setToken(config.token);
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  try {
    await rest.put(route, { body });
    console.log(
      `✅ ${body.length} comando(s) registrado(s)${config.guildId ? ` (guild ${config.guildId})` : " (global)"}`,
    );
  } catch (error) {
    console.error("[register] falha ao registrar comandos:", error);
  }
}

// ---------- cache ----------
const commands = new Collection<string, BotCommand>();

function cacheCommands(list: BotCommand[]): void {
  commands.clear();
  for (const command of list) commands.set(command.data.name, command);
  console.log(`📦 ${commands.size} comando(s) carregado(s) na memória`);
}

// ---------- interação ----------
async function respondWithError(interaction: Interaction): Promise<void> {
  if (!interaction.isRepliable()) return;

  // Tipagem explícita para o TypeScript não reclamar do enum de flags
  const payload: InteractionReplyOptions = {
    content: "❌ Ocorreu um erro ao executar o comando.",
    flags: MessageFlags.Ephemeral,
  };

  try {
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch (replyError) {
    if (!isDeadInteractionError(replyError)) {
      console.error("[interaction] falha ao responder erro:", replyError);
    }
  }
}

async function handleCommandInteraction(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const command = commands.get(interaction.commandName);

  if (!command) {
    try {
      await interaction.reply({
        content: "❌ Este comando não está disponível (cache desatualizado). Reinicie o bot.",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      if (!isDeadInteractionError(error)) {
        console.error("[interaction] falha ao avisar comando ausente:", error);
      }
    }
    return;
  }

  try {
    await command.execute(withBrandedResponses(interaction, client));
  } catch (error) {
    if (isDeadInteractionError(error)) return;
    console.error(`[comando:${interaction.commandName}] erro:`, error);
    await respondWithError(interaction);
  }
}

// ---------- client ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("clientReady", () => {
  console.log(`🤖 Bot online como ${client.user?.tag ?? "desconhecido"}`);
});

client.on("interactionCreate", (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  void handleCommandInteraction(interaction).catch((error) => {
    console.error("[interaction] erro fatal no handler:", error);
  });
});

client.on("error", (error) => {
  console.error("[client] erro de gateway:", error);
});

client.on("warn", (info) => {
  console.warn("[client] aviso:", info);
});

client.on("shardDisconnect", (event, shardId) => {
  console.warn(`[client] shard ${shardId} desconectado (${event.code})`);
});

client.on("shardReconnecting", (shardId) => {
  console.log(`[client] shard ${shardId} reconectando...`);
});

// ---------- segurança de processo ----------
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("⚠️ Uncaught exception:", error);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} recebido; desligando com segurança...`);
  try {
    await client.destroy();
  } catch (error) {
    console.error("[shutdown] erro ao fechar client:", error);
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// ---------- boot ----------
async function boot(): Promise<void> {
  const config = loadConfig();

  const loaded = loadAllCommands();
  await registerCommands(config, loaded);
  cacheCommands(loaded);

  try {
    await client.login(config.token);
  } catch (error) {
    console.error("❌ Falha no login:", error);
    process.exit(1);
  }
}

void boot().catch((error) => {
  console.error("❌ Falha fatal no boot:", error);
  process.exit(1);
});