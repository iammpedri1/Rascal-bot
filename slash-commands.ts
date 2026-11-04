require("dotenv").config();

import { CommandHandler } from "./handlers/commandHandler";
const { REST, Routes } = require("discord.js");
const { requireDiscordConfig } = require("./utils/discordConfig");

async function main() {
  const { token, clientId, guildId } = requireDiscordConfig();
  const rest = new REST({ version: "10" }).setToken(token);
  const commands = CommandHandler.discover()
    .filter(command => command.data.name !== "xp")
    .map(command => command.data.toJSON());


  await rest.put(
    Routes.applicationGuildCommands(
      clientId,
      guildId
    ),
    { body: commands }
  );

  console.log("Comandos registrados com sucesso.");
}

main().catch(error => {
  const status = error.status ? `Status ${error.status}` : "Erro";
  const code = error.code ? ` codigo ${error.code}` : "";
  const message = error.rawError?.message || error.message || "Falha desconhecida";

  console.error(`${status}${code}: ${message}`);

  if (error.status === 401) {
    console.error("Confira DISCORD_TOKEN no .env. O token atual nao foi aceito pela API do Discord.");
  }

  process.exitCode = 1;
});
