const fs = require("fs");
const path = require("path");

const logger = require("../utils/logger");

module.exports = client => {
  const commandsPath = path.join(__dirname, "../commands");
  const files = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

  for (const file of files) {
    const command = require(path.join(commandsPath, file));
    if (!command?.data || !command?.execute) continue;

    client.commands.set(command.data.name, command);
    logger.info(`Comando carregado: /${command.data.name}`);
  }
};
