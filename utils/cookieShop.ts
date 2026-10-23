const emoji = require("./emojis");

const COLOR_ITEMS = [
  {
    id: "trabalho",
    kind: "color",
    name: "Dourado",
    emoji: emoji.work,
    description: "Uma cor dourada para destacar seu inventário.",
    price: 1800,
    color: 0xf1c40f,
  },
  {
    id: "festa",
    kind: "color",
    name: "Rosa Neon",
    emoji: emoji.party,
    description: "Um rosa vibrante para deixar seu perfil em evidência.",
    price: 2200,
    color: 0xeb459e,
  },
  {
    id: "arcade",
    kind: "color",
    name: "Azul Arcade",
    emoji: emoji.gamesIcon,
    description: "Azul inspirado nos jogos e desafios da comunidade.",
    price: 2600,
    color: 0x5865f2,
  },
  {
    id: "voz",
    kind: "color",
    name: "Turquesa",
    emoji: emoji.voice,
    description: "Um tom leve inspirado nos canais de voz.",
    price: 3200,
    color: 0x1abc9c,
  },
  {
    id: "presente",
    kind: "color",
    name: "Esmeralda",
    emoji: emoji.gift,
    description: "Verde esmeralda para seu inventário.",
    price: 3500,
    color: 0x57f287,
  },
  {
    id: "cientista",
    kind: "color",
    name: "Safira",
    emoji: emoji.pandaCientista,
    description: "Azul profundo com um toque científico.",
    price: 4200,
    color: 0x3498db,
  },
];

const CHEST_ITEMS = [
  {
    id: "bau_bolso",
    kind: "chest",
    name: "Baú de Bolso",
    emoji: emoji.cookie,
    description: "Contém de 300 a 2.400 cookies. Sem chance de cor bônus.",
    price: 1500,
    minReward: 300,
    maxReward: 2400,
    colorDropChance: 0,
    duplicateCompensation: 0,
    color: 0xf5a623,
  },
  {
    id: "bau_cromatico",
    kind: "chest",
    name: "Baú Cromático",
    emoji: emoji.ticket,
    description: "Contém de 1.000 a 7.000 cookies e 10% de chance de liberar uma cor.",
    price: 4500,
    minReward: 1000,
    maxReward: 7000,
    colorDropChance: 0.1,
    duplicateCompensation: 700,
    color: 0xeb459e,
  },
  {
    id: "bau_lendario",
    kind: "chest",
    name: "Baú Lendário",
    emoji: emoji.booster,
    description: "Contém de 2.500 a 16.000 cookies e 25% de chance de liberar uma cor.",
    price: 10000,
    minReward: 2500,
    maxReward: 16000,
    colorDropChance: 0.25,
    duplicateCompensation: 1500,
    color: 0x9b59b6,
  },
];

const VIP_ITEMS = [
  {
    id: "vip_permanente",
    kind: "vip",
    name: "VIP permanente",
    emoji: emoji.owner,
    description: "Compra única: +10% em recompensas de daily, trabalho, bônus semanal e baús.",
    price: 18000,
    color: 0xf1c40f,
  },
];

const BOOST_ITEMS = [
  {
    id: "boost_cookies",
    kind: "cookie_boost",
    name: "Boost de cookies",
    emoji: emoji.booster,
    description: "Aumenta em 50% as recompensas elegíveis por 1 hora. Ativações extras estendem o tempo.",
    price: 4000,
    duration: 60 * 60 * 1000,
    multiplier: 1.5,
    color: 0x57f287,
  },
];

const UTILITY_ITEMS = [
  {
    id: "passe_cooldown",
    kind: "cooldown_pass",
    name: "Removedor de cooldown",
    emoji: emoji.clock,
    description: "Use em um cooldown de economia ativo. O passe não é consumido se ele já terminou.",
    price: 3500,
    color: 0x58b9ff,
  },
];

const SHOP_SECTIONS = [
  {
    id: "cores",
    name: "Cores",
    emoji: emoji.palette,
    description: "Cores permanentes para personalizar o inventário.",
    items: COLOR_ITEMS,
  },
  {
    id: "vip",
    name: "VIP",
    emoji: emoji.owner,
    description: "Benefício permanente para aumentar recompensas elegíveis.",
    items: VIP_ITEMS,
  },
  {
    id: "boost",
    name: "Boost de cookies",
    emoji: emoji.booster,
    description: "Ative um multiplicador temporário para suas recompensas.",
    items: BOOST_ITEMS,
  },
  {
    id: "caixas",
    name: "Caixas",
    emoji: emoji.gift,
    description: "Abra caixas para tentar ganhar cookies e uma cor bônus.",
    items: CHEST_ITEMS,
  },
  {
    id: "utilidades",
    name: "Removedor de cooldown",
    emoji: emoji.clock,
    description: "Libere um cooldown ativo usando um item consumível.",
    items: UTILITY_ITEMS,
  },
];

const SHOP_ITEMS = [...COLOR_ITEMS, ...VIP_ITEMS, ...BOOST_ITEMS, ...CHEST_ITEMS, ...UTILITY_ITEMS];
const SHOP_ITEMS_BY_ID = Object.fromEntries(SHOP_ITEMS.map(item => [item.id, item]));

const COOLDOWN_TARGETS = [
  { id: "daily", name: "Recompensa diária", emoji: emoji.cookie },
  { id: "trabalhar", name: "Trabalhar", emoji: emoji.work },
  { id: "roubar", name: "Roubar", emoji: emoji.policePanda },
  { id: "bonus", name: "Bônus semanal", emoji: emoji.sino },
  { id: "rep", name: "Reputação", emoji: emoji.yes },
];

module.exports = {
  CHEST_ITEMS,
  BOOST_ITEMS,
  COLOR_ITEMS,
  COOLDOWN_TARGETS,
  SHOP_ITEMS,
  SHOP_ITEMS_BY_ID,
  SHOP_SECTIONS,
  VIP_ITEMS,
  UTILITY_ITEMS,
};
