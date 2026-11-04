const emoji = require("./emojis");
const { PRIMARY_GUILD_ID } = require("./primaryGuild");

const COLOR_ITEMS = [
  {
    id: "trabalho",
    kind: "color",
    name: "Dourado",
    get emoji() { return emoji.work; },
    description: "Uma cor dourada para destacar seu inventário.",
    price: 1800,
    color: 0xf1c40f,
  },
  {
    id: "festa",
    kind: "color",
    name: "Rosa Neon",
    get emoji() { return emoji.party; },
    description: "Um rosa vibrante para deixar seu perfil em evidência.",
    price: 2200,
    color: 0xeb459e,
  },
  {
    id: "arcade",
    kind: "color",
    name: "Azul Arcade",
    get emoji() { return emoji.gamesIcon; },
    description: "Azul inspirado nos jogos e desafios da comunidade.",
    price: 2600,
    color: 0x5865f2,
  },
  {
    id: "voz",
    kind: "color",
    name: "Turquesa",
    get emoji() { return emoji.voice; },
    description: "Um tom leve inspirado nos canais de voz.",
    price: 3200,
    color: 0x1abc9c,
  },
  {
    id: "presente",
    kind: "color",
    name: "Esmeralda",
    get emoji() { return emoji.gift; },
    description: "Verde esmeralda para seu inventário.",
    price: 3500,
    color: 0x57f287,
  },
  {
    id: "cientista",
    kind: "color",
    name: "Safira",
    get emoji() { return emoji.pandaCientista; },
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
    get emoji() { return emoji.cookie; },
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
    get emoji() { return emoji.ticket; },
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
    get emoji() { return emoji.booster; },
    description: "Contém de 2.500 a 16.000 cookies e 25% de chance de liberar uma cor.",
    price: 10000,
    minReward: 2500,
    maxReward: 16000,
    colorDropChance: 0.25,
    duplicateCompensation: 1500,
    color: 0x9b59b6,
  },
];


const VIP_ITEMS = [];

const BOOST_ITEMS = [
  {
    id: "boost_cookies",
    kind: "cookie_boost",
    name: "Boost de cookies",
    get emoji() { return emoji.booster; },
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
    get emoji() { return emoji.clock; },
    description: "Libera um turno, bônus semanal ou reputação em cooldown. Não pode zerar o daily nem o roubo.",
    price: 3500,
    color: 0x58b9ff,
  },
];

const SHOP_SECTIONS = [
  {
    id: "cores",
    name: "Cores",
    get emoji() { return emoji.palette; },
    description: "Cargos numerados de cor do servidor.",
  },
  {
    id: "vip",
    name: "VIPs",
    get emoji() { return emoji.owner; },
    description: "Compre os cargos VIP configurados neste servidor usando cookies.",
  },
  {
    id: "aceleradores",
    name: "Aceleradores de tempo",
    get emoji() { return emoji.clock; },
    description: "Desbloqueie daily, roubo ou trabalho na hora.",
  },
];

const DEFAULT_VIP_ROLE_PRICES = [12000, 30000, 60000];
const configuredColorPrice = Number(process.env.SHOP_COLOR_ROLE_PRICE);
const COLOR_ROLE_PRICE = Number.isSafeInteger(configuredColorPrice) && configuredColorPrice > 0
  ? configuredColorPrice
  : 6000;
const VIP_ROLE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const configuredVipPrices = String(process.env.SHOP_VIP_ROLE_PRICES || "")
  .split(",")
  .map(value => Number(value.trim()));
const VIP_ROLE_PRICES = configuredVipPrices.length >= 3 && configuredVipPrices.every(price =>
  Number.isSafeInteger(price) && price > 0
) ? configuredVipPrices : DEFAULT_VIP_ROLE_PRICES;
const VIP_ROLE_PRICES_BY_ID = new Map(
  String(process.env.SHOP_VIP_ROLE_PRICE_MAP || "")
    .split(",")
    .map(entry => entry.trim().split(":"))
    .filter(([roleId, price]) => /^\d{17,20}$/.test(roleId || "") && Number.isSafeInteger(Number(price)) && Number(price) > 0)
    .map(([roleId, price]) => [roleId, Number(price)]),
);
const configuredColorRoleIds = new Set(
  String(process.env.SHOP_COLOR_ROLE_IDS || "").split(",").map(id => id.trim()).filter(id => /^\d{17,20}$/.test(id)),
);
const configuredVipRoleIds = new Set(
  String(process.env.SHOP_VIP_ROLE_IDS || "").split(",").map(id => id.trim()).filter(id => /^\d{17,20}$/.test(id)),
);
const RESERVED_COLOR_ROLE_NAMES = /admin|mod|staff|equipe|suporte|bot|nitro|booster|boost|premium|vip|mestre|owner|dono/i;
const RESTRICTED_ROLE_PERMISSIONS = new Set([
  "Administrator", "ManageGuild", "ManageRoles", "ManageChannels", "ManageMessages",
  "ManageWebhooks", "ManageEmojisAndStickers", "ManageNicknames", "KickMembers",
  "BanMembers", "ModerateMembers",
]);

function normalizedRoleName(roleName) {
  return String(roleName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, " $1 ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function colorRoleNumber(roleName) {

  const match = String(roleName || "").trim().match(/^🎨\s*[・·•]\s*(1[0-5]|[1-9])$/u);
  return match ? Number(match[1]) : null;
}

function vipTier(roleName) {
  const name = normalizedRoleName(roleName);
  if (name === "star vip") return 0;
  if (name === "elite vip") return 1;
  if (name === "super vip") return 2;
  return -1;
}

function vipBenefitPercent(roleOrName, fallback = 5) {
  const name = typeof roleOrName === "string" ? roleOrName : roleOrName?.name;
  const tier = vipTier(name);
  if (tier >= 0) return [5, 10, 15][tier];
  const configured = Number(roleOrName?.benefitPercent);
  return Number.isSafeInteger(configured) && configured >= 0 ? configured : fallback;
}

function numberedColorRole(roleName) {
  return colorRoleNumber(roleName);
}

function guildRoleOffers(guild, kind) {
  if (!guild || guild.id !== PRIMARY_GUILD_ID || !["color", "vip"].includes(kind)) return [];
  const botMember = guild.members.me;
  if (!botMember?.permissions.has("ManageRoles")) return [];

  const roles = [...guild.roles.cache.values()]
    .filter(role => {
      if (role.id === guild.id || role.managed || !role.editable) return false;
      if (role.permissions.toArray().some(permission => RESTRICTED_ROLE_PERMISSIONS.has(permission))) return false;
      const isVip = configuredVipRoleIds.size > 0
        ? configuredVipRoleIds.has(role.id)
        : vipTier(role.name) >= 0;
      if (kind === "vip") return isVip;
      if (configuredColorRoleIds.size > 0) {
        return configuredColorRoleIds.has(role.id) && role.color !== 0 && !isVip;
      }
      return colorRoleNumber(role.name) !== null && role.color !== 0 && !isVip && !RESERVED_COLOR_ROLE_NAMES.test(role.name);
    })
    .sort((a, b) => {
      if (kind === "color") {
        const aNumber = numberedColorRole(a.name);
        const bNumber = numberedColorRole(b.name);
        if (aNumber !== null && bNumber !== null) return aNumber - bNumber;
        if (aNumber !== null) return -1;
        if (bNumber !== null) return 1;
      }
      return a.position - b.position || a.name.localeCompare(b.name, "pt-BR");
    });

  return roles.map((role, index) => {
    let price = COLOR_ROLE_PRICE;
    let benefitPercent = 0;
    if (kind === "vip") {
      const explicitPrice = VIP_ROLE_PRICES_BY_ID.get(role.id);
      const detectedTier = vipTier(role.name);
      const tier = detectedTier >= 0 ? detectedTier : Math.min(index, VIP_ROLE_PRICES.length - 1);
      if (explicitPrice) price = explicitPrice;
      else price = VIP_ROLE_PRICES[tier];
      benefitPercent = detectedTier >= 0 ? [5, 10, 15][detectedTier] : [5, 10, 15][tier];
    }
    return {
      guildId: guild.id,
      roleId: role.id,
      name: role.name,
      mention: role.toString(),
      kind,
      price,
      benefitPercent,
      duration: kind === "vip" ? VIP_ROLE_DURATION_MS : null,
      role,
    };
  });
}

function vipBenefitsFor(roleOrOffer) {
  const benefitPercent = vipBenefitPercent(roleOrOffer);
  return `+${benefitPercent}% em cookies no /daily, /trabalhar e /bonus.`;
}

const SHOP_ITEMS = [...COLOR_ITEMS, ...VIP_ITEMS, ...BOOST_ITEMS, ...UTILITY_ITEMS];

const SHOP_ITEMS_BY_ID = Object.fromEntries([...SHOP_ITEMS, ...CHEST_ITEMS].map(item => [item.id, item]));

const COOLDOWN_TARGETS = [
  { id: "trabalhar", name: "Trabalhar", get emoji() { return emoji.work; } },
  { id: "bonus", name: "Bônus semanal", get emoji() { return emoji.sino; } },
  { id: "rep", name: "Reputação", get emoji() { return emoji.yes; } },
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
  COLOR_ROLE_PRICE,
  VIP_ROLE_DURATION_MS,
  VIP_ROLE_PRICES,
  guildRoleOffers,
  vipBenefitsFor,
  vipBenefitPercent,
};
