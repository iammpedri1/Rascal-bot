require("dotenv").config();

const {
  Client,
  Collection,
  GatewayIntentBits,
} = require("discord.js");

const loadCommands = require("./handlers/commandHandler");
const loadEvents = require("./handlers/eventHandler");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();

loadCommands(client);
loadEvents(client);

client.login(process.env.DISCORD_TOKEN);
