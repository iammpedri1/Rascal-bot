const db = require("./db");
const cooldowns = require("./cooldowns");
const { PRIMARY_GUILD_ID } = require("./primaryGuild");
const blackMarket = require("./blackMarket") as typeof import("./blackMarket");
const { COLOR_ITEMS, COOLDOWN_TARGETS, SHOP_ITEMS_BY_ID } = require("./cookieShop");
const MAX_COOKIE_AMOUNT = 2_147_483_647;

interface TransactionDetails {
  guildId?: string | null;
  guildName?: string | null;
  targetId?: string | null;
  reason?: string | null;
  note?: string | null;
  job?: string | null;
}

interface WorkProfile {
  id: string;
  balance: number;
  [key: string]: any;
}

type WorkResult =
  | {
      worked: false;
      profile: WorkProfile;
      remaining: number;
      nextAt: number;
    }
  | {
      worked: true;
      success: false;
      event: "dismissal";
      profile: WorkProfile;
      loss: number;
      reason: string | null;
      job: string;
      professionName: string;
      professionEmoji: string;
      nextAt: number;
    }
  | {
      worked: true;
      success: false;
      event: "tool_break";
      profile: WorkProfile;
      loss: number;
      job: string;
      professionName: string;
      professionEmoji: string;
      nextAt: number;
    }
  | {
      worked: true;
      success: true;
      event: "success" | "critical";
      profile: WorkProfile;
      reward: number;
      baseReward: number;
      bonus: number;
      perkBonus: number;
      job: string;
      professionName: string;
      professionEmoji: string;
      nextAt: number;
    };

// ─── Constantes ───────────────────────────────────────────────────────────────

const START_BALANCE = 100;

// Daily rewards
const DAILY_MIN_REWARD = 900;
const DAILY_MAX_REWARD = 1800;
const DAILY_STREAK_WINDOW = 48 * 60 * 60 * 1000;
const DAILY_MILESTONE_DAYS = 5;
const DAILY_MILESTONE_MIN = 1000;
const DAILY_MILESTONE_MAX = 3000;

// Work
const WORK_MIN_LOSS = 300;
const WORK_MAX_LOSS = 800;
const WORK_TOOL_MIN_LOSS = 100;
const WORK_TOOL_MAX_LOSS = 300;
const WORK_MIN_REWARD = 50;
const WORK_MAX_REWARD = 300;
const WORK_DISMISSAL_CHANCE = 0.15;
const WORK_CRITICAL_CHANCE = 0.05;
const WORK_TOOL_BREAK_CHANCE = 0.10;

const WORK_PROFESSIONS = [
  ["Jardineiro(a)", "🌳", 800, 1500],
  ["Programador(a)", "💻", 1500, 3000],
  ["Cozinheiro(a)", "👨‍🍳", 700, 1200],
  ["Astronauta", "👨‍🚀", 5000, 10000],
  ["Advogado(a)", "⚖️", 2000, 4500],
  ["Médico(a)", "🩺", 2500, 5000],
  ["Engenheiro(a)", "🛠️", 1800, 3500],
  ["Artista", "🎨", 600, 1500],
  ["Músico(a)", "🎵", 700, 2000]
]