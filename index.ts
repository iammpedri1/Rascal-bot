import "dotenv/config";
import { RascalClient } from "./core/RascalClient";

const { requireDiscordConfig } = require("./utils/discordConfig") as {
  requireDiscordConfig(): { token: string; clientId: string; guildId: string };
};
const logger = require("./utils/logger");

async function main(): Promise<void> {
  const { token } = requireDiscordConfig();
  const client = new RascalClient();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} recebido; desligando com segurança.`);
    await client.shutdown();
    process.exitCode = 0;
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await client.start(token);
}

main().catch(error => {
  logger.error("Falha fatal no boot", error);
  process.exitCode = 1;
});
