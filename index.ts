import "dotenv/config";
import { RascalClient } from "./core/RascalClient";
import type { Logger } from "./types/logger";
const logger = require("./utils/logger") as Logger;

process.on("unhandledRejection", (error: unknown) => {
  logger.error("Promise rejeitada sem tratamento", error);
});

process.on("uncaughtException", (error: Error) => {
  logger.error("Exceção não tratada", error);
});

async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    logger.error("DISCORD_TOKEN não foi encontrado no .env");
    process.exitCode = 1;
    return;
  }

  const client = new RascalClient();
  try {
    await client.start(token);
  } catch (error) {
    logger.error("Falha ao iniciar o bot", error);
    client.shutdown();
    process.exitCode = 1;
  }
}

if (require.main === module) void main();
