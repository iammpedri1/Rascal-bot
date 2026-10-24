import type { Client, Guild } from "discord.js";

/** The bot is deployed for one server only; GUILD_ID is also used for command registration. */
export const PRIMARY_GUILD_ID = String(process.env.GUILD_ID || "").trim();

export function isPrimaryGuild(guildId: string | null | undefined): boolean {
  return Boolean(PRIMARY_GUILD_ID && guildId === PRIMARY_GUILD_ID);
}

export function getPrimaryGuild(client: Client): Guild | null {
  if (!PRIMARY_GUILD_ID) return null;
  return client.guilds.cache.get(PRIMARY_GUILD_ID) ?? null;
}

module.exports = { PRIMARY_GUILD_ID, isPrimaryGuild, getPrimaryGuild };
