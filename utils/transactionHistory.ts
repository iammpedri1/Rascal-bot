export interface TransactionRow {
  type: string;
  amount: number;
  targetId?: string | null;
  note?: string | null;
  createdAt: number;
}

export interface TransactionStyle {
  emoji: string;
  action: string;
  verb?: "Recebeu" | "Perdeu" | "Pagou";
}

export type EmojiResolver = (name: string) => string;
export type HistoryDirection = "prev" | "next";

export interface HistoryButton {
  direction: HistoryDirection;
  ownerId: string;
  page: number;
}

export const PAGE_SIZE = 10;

const NOTE_MAX_LENGTH = 120;
const FALLBACK_STYLE: TransactionStyle = { emoji: "cookie", action: "Movimentou cookies" };

export const TRANSACTION_STYLES: Record<string, TransactionStyle> = {
  daily: { emoji: "cookie", action: "Resgatou o /daily", verb: "Recebeu" },
  daily_streak_bonus: { emoji: "CookieStar", action: "Recebeu bônus de sequência diária", verb: "Recebeu" },
  inactivity_tax: { emoji: "cookie", action: "Pagou taxa de inatividade (1% a cada 25 dias)", verb: "Pagou" },
  daily_tax: { emoji: "cookie", action: "Pagou taxa antiga de inatividade", verb: "Pagou" },
  monthly_tax: { emoji: "cookie", action: "Pagou taxa mensal de 2%", verb: "Pagou" },
  work: { emoji: "work", action: "Trabalhou na firma", verb: "Recebeu" },
  work_dismissal: { emoji: "peepSad", action: "Foi demitido(a)", verb: "Perdeu" },
  work_loss: { emoji: "peepSad", action: "Foi demitido(a)", verb: "Perdeu" },
  bonus: { emoji: "gift", action: "Resgatou o bônus semanal", verb: "Recebeu" },
  rob_win: { emoji: "pand_happy", action: "Conseguiu roubar", verb: "Recebeu" },
  rob_loss_target: { emoji: "pand_police", action: "Foi roubado", verb: "Perdeu" },
  rob_fail: { emoji: "pand_police", action: "Foi pego tentando roubar", verb: "Perdeu" },
  rob_blocked: { emoji: "pand_police", action: "Roubo bloqueado por proteção" },
  rob_camera_protection: { emoji: "pand_police", action: "Protegeu-se de um roubo" },
  rifa_win: { emoji: "minigame", action: "Ganhou na rifa", verb: "Recebeu" },
  rifa_loss: { emoji: "minigame", action: "Perdeu na rifa", verb: "Perdeu" },
  rep: { emoji: "heartmine", action: "Enviou reputação" },
  transfer_out: { emoji: "cookie", action: "Transferiu cookies", verb: "Pagou" },
  transfer_in: { emoji: "cookie", action: "Recebeu uma transferência", verb: "Recebeu" },
  bet_win: { emoji: "minigame", action: "Ganhou uma aposta", verb: "Recebeu" },
  bet_loss: { emoji: "minigame", action: "Perdeu uma aposta", verb: "Perdeu" },
  game_stake_reserved: { emoji: "cookie", action: "Reservou aposta para minijogo", verb: "Pagou" },
  game_win: { emoji: "trophy", action: "Venceu um minijogo", verb: "Recebeu" },
  game_loss: { emoji: "peepSad", action: "Perdeu em um minijogo", verb: "Perdeu" },
  game_draw: { emoji: "handshake", action: "Empatou em um minijogo" },
  game_refund: { emoji: "correct", action: "Recebeu devolução de aposta", verb: "Recebeu" },
  duel_win: { emoji: "minigame", action: "Venceu um duelo", verb: "Recebeu" },
  duel_loss: { emoji: "minigame", action: "Perdeu um duelo", verb: "Perdeu" },
  duel_draw: { emoji: "minigame", action: "Empatou em um duelo" },
  shop_purchase: { emoji: "shop", action: "Comprou um item na loja", verb: "Pagou" },
  shop_server_role_purchase: { emoji: "roles", action: "Comprou um cargo na loja", verb: "Pagou" },
  shop_server_role_purchase_pending: { emoji: "clock", action: "Compra de cargo pendente de confirmação", verb: "Pagou" },
  shop_server_role_refund: { emoji: "correct", action: "Recebeu estorno de cargo da loja", verb: "Recebeu" },
  shop_cooldown_unlock: { emoji: "clock", action: "Usou um acelerador de tempo", verb: "Pagou" },
  shop_chest_open: { emoji: "gift", action: "Abriu uma caixa", verb: "Recebeu" },
  shop_color_drop: { emoji: "palette", action: "Recebeu uma cor da caixa" },
  shop_cooldown_reset: { emoji: "clock", action: "Usou um removedor de cooldown" },
  shop_cookie_boost: { emoji: "booster", action: "Ativou um boost de cookies" },
  weekly_messages_rank_prize: { emoji: "trophy", action: "Recebeu prêmio do ranking semanal de mensagens", verb: "Recebeu" },
  weekly_voice_rank_prize: { emoji: "trophy", action: "Recebeu prêmio do ranking semanal de voz", verb: "Recebeu" },
  weekly_transmission_rank_prize: { emoji: "trophy", action: "Recebeu prêmio do ranking semanal de transmissões", verb: "Recebeu" },
  voice_reward: { emoji: "voice", action: "Recebeu recompensa por atividade em voz", verb: "Recebeu" },
  lottery_ticket: { emoji: "ticket", action: "Comprou bilhete da loteria", verb: "Pagou" },
  lottery_win: { emoji: "trophy", action: "Ganhou a loteria semanal", verb: "Recebeu" },
  scratch_ticket: { emoji: "ticket", action: "Comprou uma raspadinha", verb: "Pagou" },
  scratch_win: { emoji: "trophy", action: "Ganhou na raspadinha", verb: "Recebeu" },
  scratch_refund: { emoji: "correct", action: "Recebeu estorno da raspadinha", verb: "Recebeu" },
  black_market_purchase: { emoji: "pand_police", action: "Comprou item no Mercado Negro", verb: "Pagou" },
  bail_paid: { emoji: "pand_police", action: "Pagou a fiança da prisão", verb: "Pagou" },
  boost_welcome_bonus: { emoji: "booster", action: "Recebeu bônus por impulsionar o servidor", verb: "Recebeu" },
};

// Preposition used before the target mention, per transaction type.
const TARGET_PREPOSITIONS = new Map<string, string>([
  ["rob_loss_target", "por"],
  ["rep", "para"],
  ["transfer_out", "para"],
  ["transfer_in", "de"],
  ["duel_win", "contra"],
  ["duel_loss", "contra"],
  ["duel_draw", "contra"],
]);

// Types whose note is appended to the action as **note**.
const BOLD_NOTE_TYPES = new Set([
  "shop_purchase",
  "shop_chest_open",
  "shop_color_drop",
  "lottery_ticket",
  "lottery_win",
  "scratch_ticket",
  "scratch_win",
  "scratch_refund",
  "black_market_purchase",
  "bail_paid",
  "boost_welcome_bonus",
]);

// Types whose note is appended to the action as plain text.
const PLAIN_NOTE_TYPES = new Set([
  "shop_server_role_purchase",
  "shop_server_role_purchase_pending",
  "shop_server_role_refund",
]);

// Types that never get a separate "> note" line.
export const NOTE_LINE_HIDDEN_TYPES: ReadonlySet<string> = new Set([
  "work",
  "work_dismissal",
  "work_loss",
  "game_stake_reserved",
  "game_refund",
  "shop_cooldown_unlock",
  "shop_cooldown_reset",
  "daily_streak_bonus",
  ...Array.from(BOLD_NOTE_TYPES),
  ...Array.from(PLAIN_NOTE_TYPES),
]);

export function getTransactionStyle(type: string): TransactionStyle {
  return Object.prototype.hasOwnProperty.call(TRANSACTION_STYLES, type)
    ? TRANSACTION_STYLES[type]
    : FALLBACK_STYLE;
}

export function safeNote(value: unknown): string {
  return String(value || "").replace(/[\r\n`]/g, " ").slice(0, NOTE_MAX_LENGTH);
}

export function transactionAction(row: TransactionRow): string {
  const style = getTransactionStyle(row.type);
  const note = safeNote(row.note);
  const target = row.targetId ? ` <@${row.targetId}>` : "";
  const preposition = TARGET_PREPOSITIONS.get(row.type);

  if (row.type === "rob_win" || row.type === "rob_fail") return `${style.action} de${target || " alguém"}`;
  if (preposition) return `${style.action}${target ? ` ${preposition}${target}` : ""}`;
  if (row.type === "work" && note) return `Trabalhou como **${note}**`;
  if ((row.type === "work_dismissal" || row.type === "work_loss") && note) return `Foi demitido(a) ${note}`;
  if (row.type === "shop_cooldown_unlock" && note.startsWith("Acelerador:")) {
    const targets = note.slice("Acelerador:".length).trim().split(",").map(command => command.trim()).join(", ");
    return `${style.action}: ${targets}`;
  }
  if (row.type === "shop_cooldown_reset" && note) return `${style.action}: /${note}`;
  if (BOLD_NOTE_TYPES.has(row.type) && note) return `${style.action}: **${note}**`;
  if (PLAIN_NOTE_TYPES.has(row.type) && note) return `${style.action}: ${note}`;
  if (row.type === "daily_streak_bonus" && note) return note;
  return style.action;
}

function formatTimestamp(createdAt: number): string {
  const seconds = createdAt == null ? Number.NaN : Math.floor(Number(createdAt) / 1000);
  return Number.isFinite(seconds) ? `<t:${seconds}:f>` : "Data desconhecida";
}

export function describeTransaction(row: TransactionRow, resolveEmoji: EmojiResolver): string {
  const style = getTransactionStyle(row.type);
  const icon = resolveEmoji(style.emoji);
  const cookie = resolveEmoji("cookie");
  const value = Number(row.amount) || 0;
  const amount = Math.abs(value).toLocaleString("pt-BR");
  const iconPrefix = icon ? `${icon} ` : "";
  const amountPrefix = cookie ? `${cookie} ` : "";
  const verb = style.verb || (value > 0 ? "Recebeu" : "Perdeu");
  const valueLine = value ? `> ${verb} ${amountPrefix}**${amount} cookies**` : "";
  const note = safeNote(row.note);
  const noteLine = note && !NOTE_LINE_HIDDEN_TYPES.has(row.type) ? `> ${note}` : "";

  return [
    `${iconPrefix}${formatTimestamp(row.createdAt)} — ${transactionAction(row)}`,
    valueLine,
    noteLine,
  ].filter(Boolean).join("\n");
}

export function totalPages(total: number): number {
  const count = Number(total);
  return Number.isFinite(count) && count > 0 ? Math.ceil(count / PAGE_SIZE) : 1;
}

export function clampPage(requested: number, pages: number): number {
  if (!Number.isFinite(requested)) return 0;
  return Math.max(0, Math.min(pages - 1, Math.trunc(requested)));
}

export function historyButtonId(direction: HistoryDirection, ownerId: string, page: number): string {
  return `transacoes|${direction}|${ownerId}|${page}`;
}

export function parseHistoryButtonId(customId: string): HistoryButton | null {
  const [, direction, ownerId, pageText] = String(customId).split("|");
  if (direction !== "prev" && direction !== "next") return null;
  if (!ownerId || !/^\d+$/.test(pageText ?? "")) return null;
  return { direction, ownerId, page: Number(pageText) };
}

export function targetPage(button: HistoryButton): number {
  return button.page + (button.direction === "next" ? 1 : -1);
}