import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Collection,
} from "discord.js";
import { MessageFlags } from "discord.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const GUILD_ID = process.env.GUILD_ID!;

const commandsPath = path.join(__dirname, "commands");
function loadCommandFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) files.push(full);
    }
  };
  walk(commandsPath);
  return files;
}

async function registerCommands() {
  const body: any[] = [];
  for (const file of loadCommandFiles()) {
    delete require.cache[require.resolve(file)];
    const mod = require(file);
    const command = mod.default ?? mod;
    if (command?.data && command?.execute) body.push(command.data.toJSON());
    else console.log(`[AVISO] ${file} sem "data" ou "execute"`);
  }

  const rest = new REST().setToken(TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) 
    : Routes.applicationCommands(CLIENT_ID);                 

  await rest.put(route, { body });
  console.log(`✅ ${body.length} comando(s) registrado(s)`);
}

const commands = new Collection<string, any>();
function reloadCommandCache() {
  commands.clear();
  for (const file of loadCommandFiles()) {
    delete require.cache[require.resolve(file)];
    const mod = require(file);
    const command = mod.default ?? mod;
    if (command?.data && command?.execute) {
      commands.set(command.data.name, command);
    }
  }
  console.log(`📦 ${commands.size} comando(s) carregado(s) na memória`);
}
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("clientReady", () => {
  console.log(`🤖 Bot online como ${client.user?.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Erro no comando ${interaction.commandName}:`, err);
    const msg = { content: "❌ Ocorreu um erro ao executar o comando.", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

(async () => {
  try {
    await registerCommands();
    reloadCommandCache();
    await client.login(TOKEN);
  } catch (err) {
    console.error("❌ Falha ao iniciar:", err);
    process.exit(1);
  }
})();