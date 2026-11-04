require("dotenv").config();
const { REST, Routes } = require("discord.js");
const { requireDiscordConfig } = require("./utils/discordConfig");

async function main() {
  const { token, clientId, guildId } = requireDiscordConfig();
  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: [] }
  );

  await rest.put(
    Routes.applicationCommands(clientId),
    { body: [] }
  );

  console.log("🧨 TODOS os comandos limpos (global + guild)");
}

main().catch(error => {
  console.error("Falha ao limpar comandos globais e da guilda:", error);
  process.exitCode = 1;
});
