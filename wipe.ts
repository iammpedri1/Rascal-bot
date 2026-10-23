require("dotenv").config();
const { REST, Routes } = require("discord.js");

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: [] }
  );

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: [] }
  );

  console.log("🧨 TODOS os comandos limpos (global + guild)");
})();