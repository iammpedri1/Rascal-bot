const { startBirthdayScheduler } = require("../utils/birthdays");
const { startRankRewardScheduler } = require("../utils/rankRewards");
const { startRichPresence } = require("../utils/richPresence");
const { startMemberCounterUpdater } = require("../utils/memberCounter");
const { startReminderScheduler } = require("../utils/reminders");
const { seedActiveVoiceSessions } = require("../utils/voiceStats");
const emoji = require("../utils/emojis");
const logger = require("../utils/logger");

module.exports = {
  name: "clientReady",
  once: true,

  async execute(client) {
    logger.success(`Bot online como ${client.user.tag}`);

    try {
      const appEmojis = await client.application?.emojis.fetch();
      if (appEmojis) {
        const result = emoji.setApplicationEmojis(appEmojis);
        for (const applicationEmoji of appEmojis.values()) {
          logger.info(`Emoji carregado: ${applicationEmoji.name} -> ${applicationEmoji.toString()}`);
        }
        logger.info("Emojis do Developer Portal aplicados", {
          total: result.total,
          aliasesAtualizados: result.replaced.length,
        });
      }
    } catch (error) {
      logger.error("Erro ao buscar emojis do Developer Portal", error);
    }

    startRichPresence(client);
    startBirthdayScheduler(client);
    startRankRewardScheduler(client);
    startMemberCounterUpdater(client);
    startReminderScheduler(client);
    seedActiveVoiceSessions(client);
  },
};
