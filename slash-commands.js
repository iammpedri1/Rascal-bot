require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  const commands = [];

  const files = fs.readdirSync("./commands").filter(f => f.endsWith(".js"));

  for (const file of files) {
    const cmd = require(`./commands/${file}`);

    if (!cmd?.data) continue;

    commands.push(cmd.data.toJSON());
  }

  // DEBUG IMPORTANTE
  console.log("📦 comandos finais:", commands.map(c => c.name));

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );

  console.log("✅ registrado limpo");
})();