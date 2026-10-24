const { PRIMARY_GUILD_ID } = require("../utils/primaryGuild");
const logger = require("../utils/logger");

module.exports = {
  name: "guildCreate",

  async execute(guild) {
    if (guild.id === PRIMARY_GUILD_ID) return;
    try {
      await guild.leave();
      logger.warn("Convite ignorado: Rascal é exclusivo do servidor configurado", {
        guildId: guild.id,
        guildName: guild.name,
      });
    } catch (error) {
      logger.error("Não foi possível sair do servidor não autorizado", error, { guildId: guild.id });
    }
  },
};
