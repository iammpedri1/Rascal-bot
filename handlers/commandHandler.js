const fs = require("fs");
const path = require("path");

module.exports = (client) => {
  const commandsPath = path.join(__dirname, "../commands");
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const command = require(`${commandsPath}/${file}`);

    client.commands.set(command.data.name, command);

    console.log(`📦 Comando carregado: /${command.data.name}`);
  }
};