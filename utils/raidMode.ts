const activeGuilds = new Map();

function enableRaidMode(guildId, data = {}) {
  activeGuilds.set(String(guildId), {
    enabledAt: Date.now(),
    ...data,
  });
}

function disableRaidMode(guildId) {
  return activeGuilds.delete(String(guildId));
}

function isRaidModeEnabled(guildId) {
  return activeGuilds.has(String(guildId));
}

function getRaidMode(guildId) {
  return activeGuilds.get(String(guildId)) || null;
}

module.exports = {
  disableRaidMode,
  enableRaidMode,
  getRaidMode,
  isRaidModeEnabled,
};
