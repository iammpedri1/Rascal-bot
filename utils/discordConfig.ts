function requireDiscordConfig() {
  const token = process.env.DISCORD_TOKEN?.trim();
  const clientId = process.env.CLIENT_ID?.trim();
  const guildId = process.env.GUILD_ID?.trim();

  if (!token || !clientId || !guildId) {
    const missing = [
      !token && "DISCORD_TOKEN",
      !clientId && "CLIENT_ID",
      !guildId && "GUILD_ID",
    ].filter(Boolean);
    throw new Error(`Variáveis obrigatórias ausentes no .env: ${missing.join(", ")}`);
  }

  return { token, clientId, guildId };
}

module.exports = { requireDiscordConfig };
