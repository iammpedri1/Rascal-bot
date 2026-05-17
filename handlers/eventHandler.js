const fs = require("fs");
const path = require("path");

const logger = require("../utils/logger");

module.exports = client => {
  const eventsPath = path.join(__dirname, "../events");
  const files = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));

  const runEvent = async (event, args) => {
    try {
      await event.execute(...args, client);
    } catch (err) {
      logger.error(`Erro no evento ${event.name}`, err);
    }
  };

  for (const file of files) {
    const event = require(path.join(eventsPath, file));
    if (!event?.name || !event?.execute) continue;

    if (event.once) {
      client.once(event.name, (...args) => runEvent(event, args));
    } else {
      client.on(event.name, (...args) => runEvent(event, args));
    }

    logger.debug(`Evento carregado: ${event.name}`);
  }
};
