const { ActivityType } = require("discord.js");
const logger = require("./logger");

const PRESENCE_INTERVAL_MS = 8 * 60 * 1000;

// Atividades ligadas a recursos que existem no bot, sem simular jogos ou músicas.
const ACTIVITIES = [
  {
    name: "a comunidade",
    type: ActivityType.Watching,
    details: "Utilidades, moderação e diversão",
    state: "Explore os comandos do Rascal",
  },
  {
    name: "a economia do servidor",
    type: ActivityType.Playing,
    details: "Recompensas, loja e inventário",
    state: "/daily • /loja • /inventario",
  },
  {
    name: "os rankings da comunidade",
    type: ActivityType.Watching,
    details: "Mensagens, voz e cookies",
    state: "Consulte /ranking",
  },
  {
    name: "com a comunidade",
    type: ActivityType.Playing,
    details: "Comandos sociais e minijogos",
    state: "/ship • /meme • /fake-tweet",
  },
  {
    name: "os canais da comunidade",
    type: ActivityType.Watching,
    details: "Tickets e ferramentas de suporte",
    state: "Precisa de ajuda? Use /ticket",
  },
  {
    name: "a próxima recompensa",
    type: ActivityType.Playing,
    details: "Bônus e sequência diária",
    state: "Acompanhe em /daily e /streak",
  },
  {
    name: "a atividade do servidor",
    type: ActivityType.Watching,
    details: "Participação por mensagens, voz e transmissão",
    state: "/ranking • escolha uma categoria",
  },
  {
    name: "com seus cookies",
    type: ActivityType.Playing,
    details: "Saldo, transferências e desafios",
    state: "Consulte /cookies e /loja",
  },
];

function pickActivity(previousIndex, random = Math.random) {
  if (ACTIVITIES.length === 1) return { activity: ACTIVITIES[0], index: 0 };

  let index = Math.floor(random() * ACTIVITIES.length);
  if (index === previousIndex) index = (index + 1) % ACTIVITIES.length;
  return { activity: ACTIVITIES[index], index };
}

function createPresenceRotator(client) {
  let previousIndex = -1;
  let stopped = false;

  const applyPresence = () => {
    if (stopped || !client.user) return;

    const selected = pickActivity(previousIndex);
    previousIndex = selected.index;

    try {
      client.user.setPresence({
        status: "online",
        activities: [selected.activity],
      });
      logger.info("Rich presence atualizada", {
        activity: selected.activity.name,
        type: selected.activity.type,
        nextUpdateInSeconds: Math.floor(PRESENCE_INTERVAL_MS / 1000),
      });
    } catch (error: any) {
      logger.warn("Não foi possível atualizar a rich presence", {
        message: error?.message || String(error),
      });
    }
  };

  applyPresence();
  const timer = setInterval(applyPresence, PRESENCE_INTERVAL_MS);
  timer.unref?.();

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

let activeRotator = null;

function startRichPresence(client) {
  activeRotator?.stop();
  activeRotator = createPresenceRotator(client);
  return activeRotator;
}

module.exports = {
  ACTIVITIES,
  PRESENCE_INTERVAL_MS,
  pickActivity,
  startRichPresence,
};
