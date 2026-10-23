const { REST, Routes } = require("discord.js");
require("dotenv").config();
const { requireDiscordConfig } = require("./utils/discordConfig");

async function main() {
  const { token, clientId, guildId } = requireDiscordConfig();
  const rest = new REST({ version: "10" }).setToken(token);

  console.log("🧹 Limpando comandos...");
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
  console.log("✅ Limpo com sucesso!");
}

main().catch(error => {
  console.error("Falha ao limpar comandos da guilda:", error);
  process.exitCode = 1;
});
