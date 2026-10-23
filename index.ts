require("dotenv").config();

const {
  Client,
  Collection,
  GatewayIntentBits,
} = require("discord.js");

const loadCommands = require("./handlers/commandHandler");
const loadEvents = require("./handlers/eventHandler");
const logger = require("./utils/logger");

process.on("unhandledRejection", err => {
  logger.error("Promise rejeitada sem tratamento", err);
});

process.on("uncaughtException", err => {
  logger.error("Excecao nao tratada", err);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();

client.on("error", err => {
  logger.error("Erro do client Discord", err);
});

client.on("warn", warning => {
  logger.warn("Aviso do client Discord", { warning });
});

client.on("shardDisconnect", event => {
  logger.warn("Shard desconectada", {
    code: event?.code,
    reason: event?.reason,
  });
});

client.on("shardReconnecting", id => {
  logger.warn("Shard reconectando", { id });
});

client.on("shardResume", (id, replayedEvents) => {
  logger.info("Shard reconectada", { id, replayedEvents });
});

loadCommands(client);
loadEvents(client);

if (!process.env.DISCORD_TOKEN) {
  logger.error("DISCORD_TOKEN nao foi encontrado no .env");
  process.exitCode = 1;
} else {
  client.login(process.env.DISCORD_TOKEN).catch(err => {
    logger.error("Falha ao iniciar login do bot", err);
    process.exitCode = 1;
  });
}
