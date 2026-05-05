require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Collection,
  ActivityType,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { startReminderScheduler } = require("./utils/reminders");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

client.commands = new Collection();

// ================== CARREGAR COMANDOS ==================
const commandsPath = path.join(__dirname, "commands");
const files = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of files) {
  const command = require(path.join(commandsPath, file));

  if (!command?.data || !command?.execute) continue;

  client.commands.set(command.data.name, command);
  console.log(`Comando carregado: /${command.data.name}`);
}

// ================== INTERACOES ==================
client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Erro ao executar comando.",
          flags: 64,
        }).catch(() => {});
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

// ================== STATUS ==================
function startStatusRotation(client) {
  const getStatuses = () => [
    {
      name: "\uD83C\uDFAC Youtube",
      type: ActivityType.Watching,
    },
    {
      name: "\uD83C\uDFA7 The Weeknd",
      type: ActivityType.Listening,
    },
    {
      name: "\uD83C\uDFB5 Travis Scott",
      type: ActivityType.Listening,
    },
    {
      name: "\uD83C\uDFAE Minecraft",
      type: ActivityType.Playing,
    },
    {
      name: "\uD83D\uDD79\uFE0F Roblox",
      type: ActivityType.Playing,
    },
    {
      name: `\uD83C\uDF10 ${client.guilds.cache.size} servidores`,
      type: ActivityType.Watching,
    },
    {
      name: "\uD83D\uDEE0\uFE0F /server info",
      type: ActivityType.Playing,
    },
  ];

  let currentStatus = 0;

  const updateStatus = () => {
    const statuses = getStatuses();
    const status = statuses[currentStatus];

    client.user.setPresence({
      activities: [status],
      status: "online",
    });

    currentStatus = (currentStatus + 1) % statuses.length;
  };

  updateStatus();
  setInterval(updateStatus, 10 * 60 * 1000);
}

// ================== READY ==================
// Mudei de 'clientReady' para 'ready', que é o padrão do discord.js
client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
  startStatusRotation(client);
  startReminderScheduler(client);
});

// Mantive DISCORD_TOKEN para bater com o seu arquivo .env
client.login(process.env.DISCORD_TOKEN);