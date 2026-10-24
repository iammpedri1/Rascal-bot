import type {
  APIMessageComponentEmoji,
  ButtonBuilder,
  Client,
  Guild,
  GuildEmoji,
  StringSelectMenuOptionBuilder,
} from "discord.js";

// Catálogo em memória. A troca do mapa é atômica para manter a última versão
// válida enquanto uma atualização de rede está em andamento.
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

/** Busca todos os emojis cadastrados no Developer Portal para esta aplicação. */
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

/** Retorna um emoji pelo nome. Se não existir, retorna o fallback informado. */
export function getEmoji(name: string, fallback = "❔"): string {
  return portalEmojiFor(name) ?? fallback;
}

/** Metadados reais do emoji de aplicação, inclusive nome e URL da imagem do Portal. */
export function getEmojiDetails(name: string): ApplicationEmojiAsset | null {
  return applicationEmojiAssets.get(normalizedName(portalNameFor(name))) ?? null;
}

/** Prioriza o cache do servidor e usa os emojis da aplicação como segunda opção. */
export function getGuildEmoji(
  guild: Pick<Guild, "emojis"> | null | undefined,
  name: string,
  fallback = "",
): string {
  // Os emojis do Developer Portal são a identidade padrão do bot; o cache do
  // servidor entra apenas como alternativa quando o catálogo da aplicação não
  // contém o nome solicitado.
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

/** Lista os emojis carregados para consumidores internos e validações. */
export function getEmojiEntries(): Array<[string, string]> {
  return Array.from(emojiMap.values())
    .map(mention => [mention.match(/^<a?:([^:]+):\d+>$/)?.[1] || mention, mention] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b));
}

export function getEmojiCount(): number {
  return emojiMap.size;
}

/** Converte uma menção ou emoji Unicode para o formato que os componentes do Discord aceitam. */
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

/** Aplica emoji do servidor/aplicação em um botão, preservando animações. */
export function setGuildButtonEmoji(
  button: ButtonBuilder,
  guild: Pick<Guild, "emojis"> | null | undefined,
  name: string,
  fallback = "",
): ButtonBuilder {
  const value = getEmoji(name, "") || getGuildEmoji(guild, name, "") || fallback;
  return value ? button.setEmoji(toComponentEmoji(value)) : button;
}

/** Aplica diretamente um emoji do Developer Portal em um botão. */
export function setApplicationButtonEmoji(
  button: ButtonBuilder,
  name: string,
  fallback = "",
): ButtonBuilder {
  const value = getEmojiDetails(name)?.emoji ?? getEmoji(name, fallback);
  return value ? button.setEmoji(toComponentEmoji(value)) : button;
}

/** Aplica emoji do servidor/aplicação em uma opção de menu de seleção. */
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
  pand_police: "blobPolice",
  pand_happy: "pand_happy",
  peep_police: "peep_police",
  moneyIcon: "BlobCookies",
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
};

const normalizedAliases = new Map(
  Object.entries(legacyAliases).map(([alias, portalName]) => [normalizedName(alias), portalName])
);

const fallbacks: Record<string, string> = {
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
  work: "💼",
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
