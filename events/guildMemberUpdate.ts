import { Events, type GuildMember } from "discord.js";
import { awardFirstServerBoost } from "../utils/serverBoosts";
import { isPrimaryGuild } from "../utils/primaryGuild";

const logger = require("../utils/logger") as {
  info(message: string, metadata?: Record<string, unknown>): void;
};

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    if (!isPrimaryGuild(newMember.guild.id) || newMember.user.bot) return;
    if (oldMember.premiumSince || !newMember.premiumSince) return;

    if (awardFirstServerBoost(newMember)) {
      logger.info("Recompensa de primeiro impulso registrada", {
        guildId: newMember.guild.id,
        userId: newMember.id,
      });
    }
  },
};
