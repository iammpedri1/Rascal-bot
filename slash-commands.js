const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

const registrar = async () => {
  const comandos = [];
  const comandosPath = path.join(__dirname, 'commands');
  const arquivos = fs.readdirSync(comandosPath).filter((f) => f.endsWith('.js'));

  for (const arquivo of arquivos) {
    const comando = require(path.join(comandosPath, arquivo));
    if (comando?.data) {
      comandos.push(comando.data.toJSON());
    }
  }

  try {
    console.log(`\n🔄 Registrando ${comandos.length} slash command(s)...`);
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: comandos });
    console.log('✅ Slash commands registrados com sucesso!\n');
  } catch (err) {
    console.error('❌ Erro ao registrar comandos:', err);
  }
};

registrar();