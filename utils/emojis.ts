import type {
  APIMessageComponentEmoji,
  ButtonBuilder,
  Client,
  Guild,
  GuildEmoji,
  StringSelectMenuOptionBuilder,
} from "discord.js";

let emojiMap = new Map<string, string>();
let applicationEmojiAssets = new Map<string, ApplicationEmojiAsset>();
let refreshInFlight: Promise<void> | null = null;
export const REFRESH_INTERVAL_MS = 60 * 1000;

export interface ApplicationEmojiAsset {
  name: string;
  emoji: string;
  imageUrl: string;
  animated: boolean;
}

interface ApplicationEmojiLike {
  name?: string | null;
  toString(): string;
  imageURL?(): string;
  animated?: boolean;
}

function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

function portalNameFor(name: string): string {
  return normalizedAliases.get(normalizedName(name)) || name;
}

function portalEmojiFor(name: string): string | undefined {
  const normalized = normalizedName(portalNameFor(name));
  return emojiMap.get(normalized) ?? emojiMap.get(normalizedName(name));
}

const guildNameAliases: Record<string, string[]> = {
  pand_police: ["panda_police", "5117blobpolice"],
  policePanda: ["panda_police", "5117blobpolice"],
  blobPolice: ["panda_police", "5117blobpolice"],
  peepSad: ["peepsad", "peep_sad"],
};

function buildEmojiMap(emojis: Iterable<{ name?: string | null; toString(): string }>): Map<string, string> {
  const next = new Map<string, string>();
  for (const entry of emojis) {
    if (entry.name) next.set(normalizedName(entry.name), entry.toString());
  }
  return next;
}

function buildEmojiAssets(emojis: Iterable<ApplicationEmojiLike>): Map<string, ApplicationEmojiAsset> {
  const next = new Map<string, ApplicationEmojiAsset>();
  for (const entry of emojis) {
    const imageUrl = entry.imageURL?.();
    if (!entry.name || !imageUrl) continue;
    next.set(normalizedName(entry.name), {
      name: entry.name,
      emoji: entry.toString(),
      imageUrl,
      animated: Boolean(entry.animated),
    });
  }
  return next;
}

export async function loadEmojis(client: Client): Promise<void> {
  if (!client.isReady()) return;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = client.application.emojis.fetch()
    .then(applicationEmojis => {
      const entries = [...applicationEmojis.values()];
      emojiMap = buildEmojiMap(entries);
      applicationEmojiAssets = buildEmojiAssets(entries);
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export function getEmoji(name: string, fallback = "❔"): string {
  return portalEmojiFor(name) ?? fallback;
}

export function getEmojiDetails(name: string): ApplicationEmojiAsset | null {
  return applicationEmojiAssets.get(normalizedName(portalNameFor(name))) ?? null;
}

export function getGuildEmoji(
  guild: Pick<Guild, "emojis"> | null | undefined,
  name: string,
  fallback = "",
): string {
  const portalEmoji = portalEmojiFor(name);
  if (portalEmoji) return portalEmoji;

  const wantedNames = new Set([
    normalizedName(name),
    normalizedName(portalNameFor(name)),
    ...(guildNameAliases[normalizedName(name)] || []).map(normalizedName),
  ]);
  const guildEmoji: GuildEmoji | undefined = guild?.emojis.cache.find(entry =>
    entry.name !== null && wantedNames.has(normalizedName(entry.name))
  );

  return guildEmoji?.toString() ?? fallback;
}

export function getEmojiEntries(): Array<[string, string]> {
  return Array.from(emojiMap.values())
    .map(mention => [mention.match(/^<a?:([^:]+):\d+>$/)?.[1] || mention, mention] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b));
}

export function getEmojiCount(): number {
  return emojiMap.size;
}

export function toComponentEmoji(value: string): APIMessageComponentEmoji {
  const mention = String(value || "").match(/^<(a?):([a-zA-Z0-9_]+):(\d+)>$/);
  if (mention) {
    return {
      name: mention[2],
      id: mention[3],
      ...(mention[1] ? { animated: true } : {}),
    };
  }
  return { name: String(value || "▫️") };
}

export function setGuildButtonEmoji(
  button: ButtonBuilder,
  guild: Pick<Guild, "emojis"> | null | undefined,
  name: string,
  fallback = "",
): ButtonBuilder {
  const value = getEmoji(name, "") || getGuildEmoji(guild, name, "") || fallback;
  return value ? button.setEmoji(toComponentEmoji(value)) : button;
}

export function setApplicationButtonEmoji(
  button: ButtonBuilder,
  name: string,
  fallback = "",
): ButtonBuilder {
  const value = getEmojiDetails(name)?.emoji ?? getEmoji(name, fallback);
  return value ? button.setEmoji(toComponentEmoji(value)) : button;
}

export function setGuildOptionEmoji(
  option: StringSelectMenuOptionBuilder,
  guild: Pick<Guild, "emojis"> | null | undefined,
  name: string,
  fallback = "",
): StringSelectMenuOptionBuilder {
  const value = getEmoji(name, "") || getGuildEmoji(guild, name, "") || fallback;
  return value ? option.setEmoji(toComponentEmoji(value)) : option;
}

const legacyAliases: Record<string, string> = {
  typescript: "TypeScript",
  node: "NodeJS",
  discord: "DiscordIcon",
  database: "Database",
  rock: "Stone",
  paper: "Page",
  scissors: "Scissors",
  revolver: "Gun",
  trigger: "Gun",
  roulette: "Casino",
  cashout: "CookieStar",
  handshake: "HeartRep",
  minigame: "Game",
  circle: "Circle",
  cross: "ban",
  search: "Pesquisa",
  shield: "1178verified",
  coin: "Coin",
  cookie: "BlobCookies",
  work: "blobWowo",
  gift: "blobgift",
  peepSad: "blobno",
  sino: "Sino",
  correct: "BlobYe",
  crossed: "ban",
  spotify: "Spotify",
  heartmine: "heartmine",
  peep_boxing: "peep_Fight",
  homeIcon: "50738home",
  menuIcon: "Menu",
  settingsIcon: "Configg",
  gamesIcon: "Game",
  voice: "Voice",
  identity: "Id",
  humanIcon: "1users",
  previous: "voltar",
  next: "avancar",
  moneyIcon: "Peep_Money",
  vip1: "Vip1",
  vip2: "Vip2",
  megavip: "MegaVip",
  bronze: "bronze",
  silver: "silver",
  gold: "Gold",
  platinum: "platinum",
  diamond: "Diamond",
  ruby: "ruby",
  opal: "Opal",
  programmer: "programmer",
  pand_police: "blobPolice",
  pand_happy: "pand_happy",
  peep_police: "peep_police",
  magicWand: "Menu",
  sparkles: "CookieStar",
  streaming: "Voice",
  clipboard: "4645reportmessage",
  ticket: "4645reportmessage",
  staff: "4360discordstaffexperimental",
  lorittaCafune: "HeartRep",
  lorittaMegafone: "Megaphone",
  thinking: "Pesquisa",
  browser: "World",
  calendar: "2373events",
  announcement: "9786discordannouncementdark",
  policePanda: "blobPolice",
  miner: "Game",
  punishment: "Castigo",
  warning: "UserPerigo",
  clock: "2373events",
  yes: "blobYeyeye",
  no: "blobno",
  party: "pand_happy",
  roles: "1users",
  shop: "7182shopw",
  clap: "Like",
  likeLed: "Like",
  dislikeLed: "Dislike",
  slashCommand: "Slashcommand",
  deafened: "muteed",
  online: "On",
  idle: "blobsleep",
  dnd: "muteed",
  channel: "Channel",
  thread: "discordthreadwhite",
  botFlag: "Bot",
  keyboardWumpus: "peep_keyboard",
  booster: "188222levelboost",
  greenTick: "BlobYe",
  redTick: "No",
  pandaCientista: "Pesquisa",
  pepeReeeee: "blobno",
  blobBan: "ban",
  bugHunterLed: "9148discordgoldbughunter",
  palette: "1arte",
  owner: "4102owner",
  devs: "Discord_developer",
  js: "96295javascript",
  gg: "Like",
  oldCookie: "BlobCookies",
  info: "Info",
  server: "Server",
  member: "1users",
  ping: "PingAlto",
  trophy: "Trofeu",
  community: "Server",
  created: "2373events",
  verification: "1178verified",
  badge: "1178verified",
  discriminator: "DiscordIcon",
  badge_staff: "4360discordstaffexperimental",
  badge_partner: "4902partner",
  badge_hypesquad: "hypesquad",
  badge_bravery: "8495hypesquadhouseofbravery",
  badge_brilliance: "7693hypesquadhouseofbrilliance",
  badge_balance: "1050hypesquadhouseofbalance",
  badge_bug_hunter_2: "9148discordgoldbughunter",
  badge_verified_bot: "Discord_bot",
  badge_verified_developer: "6587earlyverifiedbotdevelopera",
  badge_certified_moderator: "2731certifiedmoderator",
  badge_active_developer: "active_developer",
};

const normalizedAliases = new Map(
  Object.entries(legacyAliases).map(([alias, portalName]) => [normalizedName(alias), portalName])
);

const fallbacks: Record<string, string> = {
  // 🚨 SEUS EMOJIS CUSTOMIZADOS AQUI (Garante que funcionem mesmo sem estar no portal)
  peep_police: "<a:peep_police:1507835774308188301>",
  pand_scary: "<a:pand_scary:1507835761934991412>",
  pandaWHY: "<a:pandaWHY:1507515891753947187>",
  peep_happy: "<a:peep_happy:1507835778426732694>",
  peep_sad: "<a:peep_sad:1501627001730105435>",
  work: "<a:work:1564005889973944431>",
  
  typescript: "🟦",
  node: "🟩",
  discord: "💬",
  database: "🗄️",
  rock: "🪨",
  paper: "📄",
  scissors: "✂️",
  revolver: "🔫",
  trigger: "💥",
  roulette: "🎰",
  cashout: "💰",
  handshake: "🤝",
  minigame: "🎮",
  circle: "⭕",
  cross: "❌",
  search: "🔎",
  shield: "🛡️",
  coin: "🪙",
  cookie: "🍪",
  server: "🌐",
  member: "👤",
  humanIcon: "👤",
  identity: "🪪",
  created: "📅",
  calendar: "📅",
  trophy: "🏆",
  clipboard: "📋",
  announcement: "📣",
  channel: "#️⃣",
  thread: "🧵",
  roles: "🎭",
  owner: "👑",
  devs: "🧑‍💻",
  botFlag: "🤖",
  ping: "🏓",
  community: "🏘️",
  verification: "🛡️",
  staff: "🛡️",
  ticket: "🎫",
  shop: "🛍️",
  clap: "👏",
  likeLed: "👍",
  dislikeLed: "👎",
  policePanda: "👮",
  punishment: "⚖️",
  warning: "⚠️",
  miner: "⛏️",
  palette: "🎨",
  lorittaCafune: "🫶",
  lorittaMegafone: "📣",
  thinking: "🤔",
  info: "ℹ️",
  party: "🎉",
  gift: "🎁",
  clock: "⏰",
  peepSad: "😔",
  sino: "🔔",
  correct: "✅",
  crossed: "❌",
  spotify: "🎵",
  heartmine: "❤️",
  peep_boxing: "🥊",
  menuIcon: "📋",
  settingsIcon: "⚙️",
  gamesIcon: "🎮",
  voice: "🔊",
  homeIcon: "🏠",
  previous: "◀️",
  next: "▶️",
  vip1: "⭐",
  vip2: "🌟",
  megavip: "✨",
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
  diamond: "💎",
  ruby: "🔻",
  opal: "⚪",
  programmer: "💻",
  moneyIcon: "💸",
  magicWand: "🪄",
  sparkles: "✨",
  slashCommand: "📋",
  deafened: "🔇",
  online: "🟢",
  idle: "🌙",
  dnd: "⛔",
  keyboardWumpus: "🎮",
  booster: "🚀",
  greenTick: "✅",
  redTick: "❌",
  pandaCientista: "🔬",
  pepeReeeee: "😔",
  blobBan: "🔨",
  bugHunterLed: "🐛",
  js: "🟨",
  gg: "👍",
  oldCookie: "🍪",
};

export function application(name: string, fallback = ""): string {
  return getEmojiDetails(name)?.emoji ?? getEmoji(name, fallback);
}

export async function fetchPortalEmojis(client: Client<true>): Promise<void> {
  return loadEmojis(client);
}

export function setApplicationEmojis(emojis: Map<string, { name?: string | null; toString(): string }>): void {
  const entries = [...emojis.values()];
  emojiMap = buildEmojiMap(entries);
  applicationEmojiAssets = buildEmojiAssets(entries);
}

const compatibilityExports = new Proxy(
  {
    REFRESH_INTERVAL_MS,
    loadEmojis,
    getEmoji,
    getEmojiDetails,
    getGuildEmoji,
    getEmojiEntries,
    getEmojiCount,
    toComponentEmoji,
    setGuildButtonEmoji,
    setApplicationButtonEmoji,
    setGuildOptionEmoji,
    application,
    fetchPortalEmojis,
    setApplicationEmojis,
  },
  {
    get(target, property: string | symbol) {
      if (typeof property !== "string") return Reflect.get(target, property);
      if (property in target) return target[property as keyof typeof target];
      const portalName = portalNameFor(property);
      return getEmoji(portalName, fallbacks[property] || "▫️");
    },
  }
);

module.exports = compatibilityExports;