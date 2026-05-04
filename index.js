require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// ================== CARREGAR COMANDOS ==================
const commandsPath = path.join(__dirname, "commands");
const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

for (const file of files) {
  const command = require(path.join(commandsPath, file));

  if (!command?.data || !command?.execute) continue;

  client.commands.set(command.data.name, command);
  console.log(`📦 Carregado: /${command.data.name}`);
}

// ================== INTERAÇÕES ==================
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      if (!interaction.replied) {
        await interaction.reply({
          content: "❌ Erro ao executar comando.",
          ephemeral: true,
        });
      }
    }
  }

  if (interaction.isButton()) {
    const name = interaction.customId.split("|")[0];
    const command = client.commands.get(name);

    if (command?.handleButton) {
      try {
        await command.handleButton(interaction);
      } catch (err) {
        console.error(err);
      }
    }
  }
});

// ================== READY ==================
client.once("ready", () => {
  console.log(`🤖 Online como ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);