const { ActivityType } = require("discord.js");

const { startReminderScheduler } = require("../utils/reminders");
const { seedActiveVoiceSessions } = require("../utils/voiceStats");
const logger = require("../utils/logger");

function startStatusRotation(client) {
  const getStatuses = () => [
    { name: "🎫 /ticket para suporte", type: ActivityType.Watching },
    { name: "🍪 economia de cookies", type: ActivityType.Playing },
    { name: "📈 XP e levels ativos", type: ActivityType.Watching },
    { name: "🪙 /cara-ou-coroa", type: ActivityType.Playing },
    { name: `🌐 ${client.guilds.cache.size} servidores`, type: ActivityType.Watching },
    { name: "✨ /user info e /xp", type: ActivityType.Playing },
  ];
  let currentStatus = 0;

  const updateStatus = () => {
    const statuses = getStatuses();
    const status = statuses[currentStatus];

    client.user.setPresence({
      activities: [status],
      status: "online",
    });

    currentStatus = (currentStatus + 1) % statuses.length;
  };

  updateStatus();
  setInterval(updateStatus, 10 * 60 * 1000);
}

module.exports = {
  name: "clientReady",
  once: true,

  execute(client) {
    logger.success(`Bot online como ${client.user.tag}`);
    startStatusRotation(client);
    startReminderScheduler(client);
    seedActiveVoiceSessions(client);
  },
};
