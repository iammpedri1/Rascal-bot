import "dotenv/config";
import { RascalClient } from "./core/RascalClient.js";
import { requireDiscordConfig } from "./utils/discordConfig.js";
import logger from "./utils/logger.js";

async function main(): Promise<void> {
  const { token } = requireDiscordConfig();
  const client = new RascalClient();
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} recebido; desligando com segurança.`);
    await client.shutdown();
    process.exitCode = 0;
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    logger.error("Promise rejeitada sem tratamento", reason);
  });
  process.on("uncaughtException", (error) => {
    logger.error("Exceção não capturada; encerrando o processo", error);
    void shutdown("uncaughtException").finally(() => {
      process.exitCode = 1;
    });
  });

  await client.start(token);
}

main().catch(error => {
  logger.error("Falha fatal no boot", error);
  process.exitCode = 1;
});