const { startBirthdayScheduler } = require("../utils/birthdays");
const { startRankRewardScheduler } = require("../utils/rankRewards");
const { startRichPresence } = require("../utils/richPresence");
const { startMemberCounterUpdater } = require("../utils/memberCounter");
const { startReminderScheduler } = require("../utils/reminders");
const { seedActiveVoiceSessions } = require("../utils/voiceStats");
const logger = require("../utils/logger");

module.exports = {
  name: "clientReady",
  once: true,

  execute(client) {
    logger.success(`Bot online como ${client.user.tag}`);
    startRichPresence(client);
    startBirthdayScheduler(client);
    startRankRewardScheduler(client);
    startMemberCounterUpdater(client);
    startReminderScheduler(client);
    seedActiveVoiceSessions(client);
  },
};
