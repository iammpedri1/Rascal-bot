require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function main() {
  const commands = [];
  const commandsPath = path.join(__dirname, "commands");
  const files = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

  for (const file of files) {
    const command = require(path.join(commandsPath, file));
    if (command?.data) commands.push(command.data.toJSON());
  }

  console.log("Comandos finais:", commands.map(command => command.name));

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
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
