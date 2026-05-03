require("dotenv").config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // Adicione o ID do bot no seu .env
const GUILD_ID = process.env.GUILD_ID;   // Adicione o ID do seu servidor no seu .env

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
const commandsJSON = []; // Array para enviar ao Discord

// --- CARREGAMENTO DOS COMANDOS ---
const comandosPath = path.join(__dirname, "commands");
const arquivos = fs.readdirSync(comandosPath).filter((f) => f.endsWith(".js"));

for (const arquivo of arquivos) {
  const comando = require(path.join(comandosPath, arquivo));
  if (comando?.data && comando?.execute) {
    client.commands.set(comando.data.name, comando);
    commandsJSON.push(comando.data.toJSON()); // Prepara o JSON para o Discord
    console.log(`📦 Comando carregado: /${comando.data.name}`);
  }
}

// --- REGISTRO NA API DO DISCORD ---
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Iniciando atualização dos comandos (/) no Discord...");

    // Registra especificamente no seu servidor (é INSTANTÂNEO)
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commandsJSON }
    );

    console.log("✅ Comandos registrados com sucesso no servidor!");
  } catch (error) {
    console.error("Erro ao registrar comandos:", error);
  }
})();

// --- EVENTOS ---
client.once("ready", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const comando = client.commands.get(interaction.commandName);
  if (!comando) return;

  try {
    await comando.execute(interaction);
  } catch (err) {
    console.error(`Erro no comando /${interaction.commandName}:`, err);
    const msg = { content: "❌ Ocorreu um erro ao executar este comando.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

client.login(TOKEN);
