const { startBirthdayScheduler } = require("../utils/birthdays");
const { startRankRewardScheduler } = require("../utils/rankRewards");
const { startRichPresence } = require("../utils/richPresence");
const { startMemberCounterUpdater } = require("../utils/memberCounter");
const { startReminderScheduler } = require("../utils/reminders");
const { seedActiveVoiceSessions, startVoiceRewardScheduler } = require("../utils/voiceStats");
const { startCooldownNotificationScheduler } = require("../utils/cooldownNotifications");
const { startMonthlyTopScheduler } = require("../utils/monthlyTop");
const { startTaxScheduler } = require("../utils/taxes");
const { startUserDataPurgeScheduler } = require("../utils/userDataPurge");
const { startGuildShopRoleExpiryScheduler } = require("../utils/guildShopRoles");
const { startRolePurchaseRecovery } = require("../utils/shopRolePurchases");
const { startWeeklyLotteryScheduler } = require("../utils/weeklyLottery");
const { startScratchCleanupScheduler } = require("../utils/scratchCards");
const { recoverPendingGameBets } = require("../utils/gameEconomy");
const giveawayCommand = require("../commands/sorteio");
const { initializeRaidLockdowns } = require("../utils/raidLockdown");
const { isImageModerationConfigured } = require("../utils/imageModeration");
const { startRuntimeMetrics } = require("../utils/runtimeMetrics");
const emoji = require("../utils/emojis");
const logger = require("../utils/logger");
const { PRIMARY_GUILD_ID } = require("../utils/primaryGuild");

module.exports = {
  name: "clientReady",
  once: true,

  async execute(client) {
    const refreshEmojis = async () => {
      try {
        await emoji.loadEmojis(client);
      } catch (error) {
        logger.error("Erro ao buscar emojis do Developer Portal", error);
      }
    };

    // Carrega o mapa real antes de anunciar o bot como pronto; se a API falhar, o fallback mantém os comandos disponíveis.
    await refreshEmojis();
    logger.info("Cache de emojis da aplicação atualizado", { count: emoji.getEmojiCount() });
    logger.success(`Bot online como ${client.user.tag}`);
    const recoveredLockdowns = initializeRaidLockdowns();
    if (recoveredLockdowns) logger.warn("Lockdowns anti-raid ativos recuperados do banco", { count: recoveredLockdowns });
    if (!isImageModerationConfigured()) logger.warn("Moderação de imagens por IA desativada: configure OPENAI_API_KEY no .env.");

    for (const guild of client.guilds.cache.values()) {
      if (guild.id === PRIMARY_GUILD_ID) continue;
      try {
        await guild.leave();
        logger.warn("Servidor removido: Rascal é exclusivo do servidor configurado", {
          guildId: guild.id,
          guildName: guild.name,
        });
      } catch (error) {
        logger.error("Não foi possível sair de um servidor fora da configuração exclusiva", error, {
          guildId: guild.id,
        });
      }
    }
    // Aplicações não recebem um evento gateway para emojis do Developer Portal.
    // Uma consulta leve por minuto atualiza o cache sem envolver os comandos.
    const emojiRefreshTimer = setInterval(refreshEmojis, emoji.REFRESH_INTERVAL_MS);
    emojiRefreshTimer.unref?.();

    startRichPresence(client);
    startBirthdayScheduler(client);
    startRankRewardScheduler(client);
    startMemberCounterUpdater(client);
    startReminderScheduler(client);
    startCooldownNotificationScheduler(client);
    startVoiceRewardScheduler();
    startMonthlyTopScheduler(client);
    startTaxScheduler(client);
    startUserDataPurgeScheduler(client);
    startGuildShopRoleExpiryScheduler(client);
    startRolePurchaseRecovery(client);
    startWeeklyLotteryScheduler(client);
    startScratchCleanupScheduler();
    startRuntimeMetrics();
    try {
      const refundedGames = recoverPendingGameBets();
      if (refundedGames > 0) logger.warn("Apostas de minijogos devolvidas após reinicialização", { count: refundedGames });
    } catch (error) {
      logger.error("Falha ao recuperar apostas pendentes de minijogos", error);
    }
    giveawayCommand.startScheduler(client);
    seedActiveVoiceSessions(client);
  },
};
