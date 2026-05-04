const cooldowns = new Map();

function checkCooldown(userId, time) {
  const now = Date.now();
  const last = cooldowns.get(userId) || 0;

  if (now - last < time) {
    return Math.ceil((time - (now - last)) / 1000);
  }

  cooldowns.set(userId, now);
  return false;
}

module.exports = { checkCooldown };