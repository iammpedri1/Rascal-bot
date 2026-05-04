const { REST, Routes } = require("discord.js");
require("dotenv").config();

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("🧹 Limpando comandos...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: [] }
    );

    console.log("✅ Limpo com sucesso!");
  } catch (err) {
    console.error(err);
  }
})();