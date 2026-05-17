const { ActivityType } = require("discord.js");

const logger = require("./logger");

const MODE_INTERVAL_MS = 5 * 60 * 1000;
const DETAIL_INTERVAL_MS = 2 * 60 * 1000;

const STATUSES = ["online", "idle", "dnd"];

const GAME_ACTIVITIES = [
  { name: "Elden Ring", details: "⚔️ Elden Ring | Nivel 150 - Farum Azula" },
  { name: "Elden Ring", details: "💀 Elden Ring | Morrendo pela 47ª vez" },
  { name: "Minecraft", details: "⛏️ Minecraft | Construindo base no survival" },
  { name: "Minecraft", details: "🏠 Minecraft | Aldeao me roubando espaco" },
  { name: "Valorant", details: "🎯 Valorant | Ranked - Tentando subir de elo" },
  { name: "Valorant", details: "💥 Valorant | Clutch 1v5 quase funcionou" },
  { name: "League of Legends", details: "🏆 League of Legends | Mid lane sofrendo" },
  { name: "League of Legends", details: "📉 League of Legends | LP indo embora" },
  { name: "GTA V", details: "🚗 GTA V | Fugindo da policia estrela 5" },
  { name: "GTA V", details: "💰 GTA V | Fazendo missao do Lester" },
  { name: "Red Dead Redemption 2", details: "🤠 RDR2 | Explorando o oeste selvagem" },
  { name: "Red Dead Redemption 2", details: "🐎 RDR2 | Cavalo morreu de novo" },
  { name: "Cyberpunk 2077", details: "🌆 Cyberpunk 2077 | Night City a noite" },
  { name: "The Witcher 3", details: "🐺 The Witcher 3 | Cacando monstros" },
  { name: "Dark Souls III", details: "☠️ Dark Souls III | Isso e injusto" },
  { name: "Hollow Knight", details: "🦋 Hollow Knight | Perdido nas profundezas" },
  { name: "Stardew Valley", details: "🌾 Stardew Valley | Dia 1 da primavera" },
  { name: "Among Us", details: "📫 Among Us | Era o suspeito mesmo" },
  { name: "Fortnite", details: "🏗️ Fortnite | Construindo igual louco" },
  { name: "Apex Legends", details: "🔫 Apex Legends | Dropando Skulltown" },
  { name: "Counter-Strike 2", details: "💣 Counter-Strike 2 | Clutch na B" },
];

const GAME_STATES = [
  "⚔️ Sem graca de morrer",
  "💀 Skill issue confirmado",
  "🏆 Campeao em breve",
  "🛡️ Tentando nao morrer",
  "😤 Ranked me odeia",
  "🎮 Mais um round",
  "🔥 Warming up",
  "😴 Jogando no automatico",
  "🤝 Duo queue",
  "🎯 Mirando diferente hoje",
];

const MUSIC_DETAILS = [
  "🎵 Sabrina Carpenter - Espresso",
  "🎵 The Weeknd - Blinding Lights",
  "🎵 Travis Scott - SICKO MODE",
  "🎵 Kanye West - Stronger",
  "🎵 Drake - God's Plan",
  "🎵 Kendrick Lamar - HUMBLE.",
  "🎵 Billie Eilish - bad guy",
  "🎵 Ariana Grande - 7 rings",
  "🎵 Post Malone - Rockstar",
  "🎵 Doja Cat - Say So",
  "🎵 Harry Styles - As It Was",
  "🎵 Olivia Rodrigo - drivers license",
  "🎵 Bad Bunny - Titi Me Pregunto",
  "🎵 J. Cole - No Role Modelz",
  "🎵 Eminem - Lose Yourself",
  "🎵 Lana Del Rey - Summertime Sadness",
  "🎵 Arctic Monkeys - Do I Wanna Know?",
  "🎵 Tame Impala - The Less I Know The Better",
  "🎵 Frank Ocean - Nights",
  "🎵 Tyler the Creator - EARFQUAKE",
  "🎵 SZA - Kill Bill",
  "🎵 Peso Pluma - Ella Baila Sola",
  "🎵 Matue - 777",
  "🎵 WIU - Anjinho do Mal",
  "🎵 Don Toliver - After Party",
];

const MUSIC_STATES = [
  "🔀 No shuffle",
  "🔁 Repetindo pela 10ª vez",
  "🎧 Fone no volume maximo",
  "💿 Album completo",
  "🎶 Essa e boa demais",
  "😌 Vibe perfeita",
  "🕺 Dancando aqui",
  "📻 Radio do Spotify mandou bem",
];

const WATCH_PLATFORMS = ["Netflix", "HBO Max", "Disney+", "Prime Video"];
const WATCH_DETAILS = [
  "📺 The Last of Us - S02E03",
  "🐉 House of the Dragon - S02E01",
  "👔 Succession - S04E10",
  "⚗️ Breaking Bad - S05E14",
  "⚗️ Better Call Saul - S06E13",
  "👑 Game of Thrones - S08E06",
  "🧟 The Walking Dead - S11E24",
  "🔫 Peaky Blinders - S06E06",
  "🕵️ Sherlock - S04E03",
  "🌌 Stranger Things - S04E09",
  "💊 Euphoria - S02E05",
  "🤵 The Crown - S06E10",
  "🧠 Black Mirror - S06E03",
  "🏦 La Casa de Papel - S05E10",
  "🦸 Loki - S02E06",
  "🕷️ Wandavision - S01E09",
  "🧙 The Witcher - S03E08",
  "🎭 Arcane - S02E09",
  "🌮 Narcos - S03E10",
  "🎪 Dark - S03E08",
  "🤖 Westworld - S04E08",
  "🦕 Jurassic World - Chaos Theory S01E06",
  "🕵️ True Detective - S04E06",
  "🎬 Oppenheimer",
  "🦇 The Batman",
  "🕷️ Spider-Man: No Way Home",
  "🌀 Duna: Parte 2",
];

const WATCH_STATES = [
  "📺 Maratonando sem parar",
  "😱 Que episodio foi esse",
  "🍿 Nao consigo parar",
  "😭 Chorando aqui",
  "🤯 Nao acredito no que vi",
  "⏸️ Pausei pra processar",
  "😤 Esse personagem me irrita",
  "🫣 Assistindo pelos dedos",
  "💬 Spoiler nao por favor",
  "🔥 Melhor serie do ano",
];

const YOUTUBE_DETAILS = [
  "🎮 Casimiro - React ao vivo",
  "😂 Whindersson Nunes - Stand up novo",
  "🔧 Pirula - Ciencia explicada",
  "🌍 Porta dos Fundos - Esquete nova",
  "💻 Filipe Deschamps - Dev tips",
  "🏆 Gaules - Live de CS",
  "🎯 MrBeast - Desafio milionário",
  "📱 Linus Tech Tips - Review de hardware",
  "🎤 Legends of Gaming - Batalha de youtubers",
  "🍕 Felipe Neto - Video novo",
  "🎮 Cellbit - Roleplay no servidor",
  "🧪 Kurzgesagt - Animacao cientifica",
  "🤣 Falcao - Podcast novo",
  "🎵 Nostalgia - Retrospectiva musical",
  "📰 Manual do Mundo - Experiencia insana",
  "🔬 Atila Iamarino - Ciencia seria",
  "🎙️ Flow Podcast - Entrevista polemica",
  "🏀 Chico Loco - Analise esportiva",
  "🎮 Monark - Debate aquecido",
  "🌎 Nerdologia - Historia explicada",
  "😂 PewDiePie - Reagindo a memes",
  "🎮 Markiplier - Horror game",
  "📊 MKBHD - Tech review top",
  "🔥 Veritasium - Experimento bizarro",
];

const YOUTUBE_STATES = [
  "▶️ Assistindo agora",
  "👍 Ja dei like",
  "🔔 Notificacoes ativadas",
  "💬 Comentando aqui",
  "📌 Salvei pra ver depois",
  "🔄 Ja e a 3ª vez que assisto",
  "😂 Morrendo de rir",
  "🤔 Aprendi algo novo",
  "📢 Mandei pro amigo",
  "⏩ Pulei a propaganda",
];

function randomItem(list, lastValue) {
  if (list.length <= 1) return list[0];

  let next = list[Math.floor(Math.random() * list.length)];
  while (next === lastValue) {
    next = list[Math.floor(Math.random() * list.length)];
  }

  return next;
}

function seconds(ms) {
  return Math.round(ms / 1000);
}

function createPresenceRotator(client) {
  const onlineSince = new Date();
  let modeIndex = 0;
  let currentStatus = randomItem(STATUSES);
  let lastActivityKey = null;
  let lastState = null;

  const modes = [
    {
      label: "JOGANDO",
      build() {
        const picked = randomItem(GAME_ACTIVITIES, lastActivityKey);
        lastActivityKey = picked;
        lastState = randomItem(GAME_STATES, lastState);

        return {
          name: picked.name,
          type: ActivityType.Playing,
          details: picked.details,
          state: lastState,
        };
      },
    },
    {
      label: "OUVINDO MUSICA",
      build() {
        const details = randomItem(MUSIC_DETAILS, lastActivityKey);
        lastActivityKey = details;
        lastState = randomItem(MUSIC_STATES, lastState);

        return {
          name: "Spotify",
          type: ActivityType.Listening,
          details,
          state: lastState,
        };
      },
    },
    {
      label: "ASSISTINDO",
      build() {
        const name = randomItem(WATCH_PLATFORMS);
        const details = randomItem(WATCH_DETAILS, lastActivityKey);
        lastActivityKey = details;
        lastState = randomItem(WATCH_STATES, lastState);

        return {
          name,
          type: ActivityType.Watching,
          details,
          state: lastState,
        };
      },
    },
    {
      label: "YOUTUBE",
      build() {
        const details = randomItem(YOUTUBE_DETAILS, lastActivityKey);
        lastActivityKey = details;
        lastState = randomItem(YOUTUBE_STATES, lastState);

        return {
          name: "YouTube",
          type: ActivityType.Watching,
          details,
          state: lastState,
        };
      },
    },
  ];

  // Aplica o modo atual. Quando troca de modo, tambem troca o status do bot.
  function applyPresence(reason = "detail") {
    const mode = modes[modeIndex];
    const activity = mode.build();

    client.user.setPresence({
      activities: [{
        ...activity,
        timestamps: {
          start: onlineSince,
        },
      }],
      status: currentStatus,
    });

    logger.info("Rich presence atualizada", {
      mode: mode.label,
      reason,
      name: activity.name,
      details: activity.details,
      state: activity.state,
      status: currentStatus,
      nextDetailIn: seconds(DETAIL_INTERVAL_MS),
      nextModeIn: seconds(MODE_INTERVAL_MS),
    });
  }

  function nextMode() {
    modeIndex = (modeIndex + 1) % modes.length;
    currentStatus = randomItem(STATUSES, currentStatus);
    lastActivityKey = null;
    lastState = null;
    applyPresence("mode");
  }

  applyPresence("start");

  const detailTimer = setInterval(() => applyPresence("detail"), DETAIL_INTERVAL_MS);
  const modeTimer = setInterval(nextMode, MODE_INTERVAL_MS);

  return {
    stop() {
      clearInterval(detailTimer);
      clearInterval(modeTimer);
    },
  };
}

let activeRotator = null;

function startRichPresence(client) {
  if (activeRotator) activeRotator.stop();
  activeRotator = createPresenceRotator(client);
  return activeRotator;
}

module.exports = {
  DETAIL_INTERVAL_MS,
  MODE_INTERVAL_MS,
  startRichPresence,
};
