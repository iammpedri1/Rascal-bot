const db = require("./db");
const logger = require("./logger");
const { PRIMARY_GUILD_ID } = require("./primaryGuild");

let schedulerStarted = false;
let cleanupRunning = false;

async function removeExpiredGuildVipRoles(client, now = Date.now()) {
  if (cleanupRunning) return;
  cleanupRunning = true;

  try {
    const expired = db.prepare("SELECT guild_id AS guildId, user_id AS userId, role_id AS roleId, expires_at AS expiresAt FROM guild_shop_role_purchases WHERE guild_id = ? AND kind = 'vip' AND expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at LIMIT 50")
      .all(PRIMARY_GUILD_ID, now);

    for (const purchase of expired) {
      const guild = client.guilds.cache.get(purchase.guildId);
      if (!guild) continue;

      const member = guild.members.cache.get(purchase.userId) ||
        await guild.members.fetch(purchase.userId).catch(error => {
          if ((error as any)?.code !== 10007 && (error as any)?.code !== 10013) {
            logger.warn("Não foi possível consultar cargo VIP expirado", {
              guildId: purchase.guildId,
              userId: purchase.userId,
              code: (error as any)?.code,
            });
          }
          return null;
        });
      const role = guild.roles.cache.get(purchase.roleId);
      const current = db.prepare("SELECT expires_at AS expiresAt FROM guild_shop_role_purchases WHERE guild_id = ? AND user_id = ? AND role_id = ? AND kind = 'vip'")
        .get(purchase.guildId, purchase.userId, purchase.roleId);
      if (!current || current.expiresAt !== purchase.expiresAt || current.expiresAt > Date.now()) continue;

      if (member && role && member.roles.cache.has(role.id)) {
        try {
          await member.roles.remove(role, "VIP comprado na loja expirou");
        } catch (error) {
          logger.warn("Não foi possível remover cargo VIP expirado", {
            guildId: purchase.guildId,
            userId: purchase.userId,
            roleId: purchase.roleId,
            code: (error as any)?.code,
          });
          continue;
        }
      }

      const renewed = db.prepare("SELECT expires_at AS expiresAt FROM guild_shop_role_purchases WHERE guild_id = ? AND user_id = ? AND role_id = ? AND kind = 'vip'")
        .get(purchase.guildId, purchase.userId, purchase.roleId);
      if (renewed && renewed.expiresAt !== purchase.expiresAt) {
        if (member && role && renewed.expiresAt > Date.now() && !member.roles.cache.has(role.id)) {
          await member.roles.add(role, "VIP renovado durante a limpeza de expirados").catch(error => {
            logger.warn("Não foi possível reaplicar cargo VIP renovado", {
              guildId: purchase.guildId,
              userId: purchase.userId,
              roleId: purchase.roleId,
              code: (error as any)?.code,
            });
          });
        }
        continue;
      }

      db.prepare("DELETE FROM guild_shop_role_purchases WHERE guild_id = ? AND user_id = ? AND role_id = ? AND kind = 'vip' AND expires_at = ?")
        .run(purchase.guildId, purchase.userId, purchase.roleId, purchase.expiresAt);
    }
  } finally {
    cleanupRunning = false;
  }
}

function startGuildShopRoleExpiryScheduler(client) {
  if (schedulerStarted) return;
  schedulerStarted = true;
  void removeExpiredGuildVipRoles(client).catch(error =>
    logger.error("Falha ao limpar cargos VIP expirados", error)
  );
  const timer = setInterval(() => {
    void removeExpiredGuildVipRoles(client).catch(error =>
      logger.error("Falha ao limpar cargos VIP expirados", error)
    );
  }, 5 * 60 * 1000);
  timer.unref?.();
}

module.exports = { removeExpiredGuildVipRoles, startGuildShopRoleExpiryScheduler };
