const fs = require("fs");
const path = require("path");

const logger = require("../utils/logger");

module.exports = client => {
  const eventsPath = path.join(__dirname, "../events");
  const files = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));

  for (const file of files) {
    const event = require(path.join(eventsPath, file));
    if (!event?.name || !event?.execute) continue;

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }

    logger.info(`Evento carregado: ${event.name}`);
  }
};
