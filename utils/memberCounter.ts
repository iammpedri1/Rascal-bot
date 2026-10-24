const { ChannelType } = require("discord.js");

const logger = require("./logger");
const { getPrimaryGuild } = require("./primaryGuild");

const MEMBER_COUNTER_INTERVAL_MS = Number(process.env.MEMBER_COUNTER_INTERVAL_MS || 10 * 60 * 1000);

async function updateGuildMemberCounter(guild) {
  const channel = guild.channels.cache.find(item =>
    item.type === ChannelType.GuildVoice &&
    item.name.startsWith("👥 Membros")
  );

  if (!channel) return false;

  const nextName = `👥 Membros: ${guild.memberCount}`;
  if (channel.name !== nextName) {
    await channel.setName(nextName, "Atualizar contador de membros").catch(error => {
      logger.warn("Erro ao atualizar contador de membros", {
        guild: guild.id,
        channel: channel.id,
        error: error.message,
      });
    });
  }

  return true;
}

function startMemberCounterUpdater(client) {
  const updateAll = () => {
    const guild = getPrimaryGuild(client);
    if (!guild) return;
    updateGuildMemberCounter(guild).catch(error => {
      logger.warn("Erro no ciclo do contador de membros", {
        guild: guild.id,
        error: error.message,
      });
    });
  };

  updateAll();
  const timer = setInterval(updateAll, MEMBER_COUNTER_INTERVAL_MS);
  timer.unref?.();
}

module.exports = {
  startMemberCounterUpdater,
  updateGuildMemberCounter,
};
