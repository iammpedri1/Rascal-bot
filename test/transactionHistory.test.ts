import { test } from "node:test";
import assert = require("node:assert/strict");
import {
  NOTE_LINE_HIDDEN_TYPES,
  PAGE_SIZE,
  TRANSACTION_STYLES,
  clampPage,
  describeTransaction,
  getTransactionStyle,
  historyButtonId,
  parseHistoryButtonId,
  safeNote,
  targetPage,
  totalPages,
  transactionAction,
} from "../utils/transactionHistory";
import type { TransactionRow } from "../utils/transactionHistory";

const OWNER_ID = "123456789012345678";
const CREATED_AT = 1700000000000;

function row(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return { type: "daily", amount: 100, targetId: null, note: null, createdAt: CREATED_AT, ...overrides };
}

const withEmoji = (name: string): string => `:${name}:`;
const withoutEmoji = (): string => "";

test("safeNote removes line breaks and backticks", () => {
  assert.equal(safeNote("a\r\nb`c`"), "a  b c ");
});

test("safeNote handles empty values and truncates to 120 characters", () => {
  assert.equal(safeNote(null), "");
  assert.equal(safeNote(undefined), "");
  assert.equal(safeNote("x".repeat(200)).length, 120);
});

test("getTransactionStyle falls back for unknown and inherited keys", () => {
  for (const type of ["unknown_type", "constructor", "toString", "__proto__"]) {
    assert.deepEqual(getTransactionStyle(type), { emoji: "cookie", action: "Movimentou cookies" });
  }
});

test("every transaction style has an emoji and an action", () => {
  for (const [type, style] of Object.entries(TRANSACTION_STYLES)) {
    assert.ok(style.emoji, `${type} has no emoji`);
    assert.ok(style.action, `${type} has no action`);
  }
});

test("every type with a note rule exists in the style table", () => {
  const known = Object.keys(TRANSACTION_STYLES);
  NOTE_LINE_HIDDEN_TYPES.forEach(type => {
    assert.ok(known.includes(type), `${type} is not in TRANSACTION_STYLES`);
  });
});

test("transactionAction mentions the target with the right preposition", () => {
  const cases: Array<[string, string]> = [
    ["rob_win", "Conseguiu roubar de <@42>"],
    ["rob_fail", "Foi pego tentando roubar de <@42>"],
    ["rob_loss_target", "Foi roubado por <@42>"],
    ["rep", "Enviou reputação para <@42>"],
    ["transfer_out", "Transferiu cookies para <@42>"],
    ["transfer_in", "Recebeu uma transferência de <@42>"],
    ["duel_win", "Venceu um duelo contra <@42>"],
    ["duel_loss", "Perdeu um duelo contra <@42>"],
    ["duel_draw", "Empatou em um duelo contra <@42>"],
  ];
  for (const [type, expected] of cases) {
    assert.equal(transactionAction(row({ type, targetId: "42" })), expected);
  }
});

test("transactionAction works without a target", () => {
  assert.equal(transactionAction(row({ type: "rob_win" })), "Conseguiu roubar de alguém");
  assert.equal(transactionAction(row({ type: "rob_loss_target" })), "Foi roubado");
  assert.equal(transactionAction(row({ type: "rep" })), "Enviou reputação");
  assert.equal(transactionAction(row({ type: "duel_win" })), "Venceu um duelo");
});

test("transactionAction uses the note when the type has a template", () => {
  assert.equal(transactionAction(row({ type: "work", note: "Programador" })), "Trabalhou como **Programador**");
  assert.equal(transactionAction(row({ type: "work_loss", note: "por faltar" })), "Foi demitido(a) por faltar");
  assert.equal(transactionAction(row({ type: "shop_purchase", note: "VIP" })), "Comprou um item na loja: **VIP**");
  assert.equal(
    transactionAction(row({ type: "shop_server_role_purchase", note: "Cargo X" })),
    "Comprou um cargo na loja: Cargo X",
  );
  assert.equal(
    transactionAction(row({ type: "shop_cooldown_reset", note: "daily" })),
    "Usou um removedor de cooldown: /daily",
  );
  assert.equal(
    transactionAction(row({ type: "daily_streak_bonus", note: "Sequência de 7 dias" })),
    "Sequência de 7 dias",
  );
});

test("transactionAction falls back to the base action without a note", () => {
  assert.equal(transactionAction(row({ type: "work" })), "Trabalhou na firma");
  assert.equal(transactionAction(row({ type: "shop_purchase" })), "Comprou um item na loja");
  assert.equal(transactionAction(row({ type: "daily_streak_bonus" })), "Recebeu bônus de sequência diária");
  assert.equal(transactionAction(row({ type: "unknown_type" })), "Movimentou cookies");
});

test("cooldown unlock lists the accelerated commands", () => {
  assert.equal(
    transactionAction(row({ type: "shop_cooldown_unlock", note: "Acelerador: daily , work,bonus" })),
    "Usou um acelerador de tempo: daily, work, bonus",
  );
});

test("describeTransaction builds icon, timestamp, action and value lines", () => {
  const text = describeTransaction(row({ type: "daily", amount: 1500 }), withEmoji);
  assert.equal(
    text,
    [":cookie: <t:1700000000:f> — Resgatou o /daily", "> Recebeu :cookie: **1.500 cookies**"].join("\n"),
  );
});

test("describeTransaction omits emoji prefixes when emojis are unavailable", () => {
  const text = describeTransaction(row({ type: "daily", amount: 10 }), withoutEmoji);
  assert.equal(text, "<t:1700000000:f> — Resgatou o /daily\n> Recebeu **10 cookies**");
});

test("the verb comes from the style, or from the sign when the style has none", () => {
  const valueLine = (type: string, amount: number): string =>
    describeTransaction(row({ type, amount }), withoutEmoji).split("\n")[1];

  assert.equal(valueLine("monthly_tax", -20), "> Pagou **20 cookies**");
  assert.equal(valueLine("unknown_type", 30), "> Recebeu **30 cookies**");
  assert.equal(valueLine("unknown_type", -30), "> Perdeu **30 cookies**");
});

test("describeTransaction skips the value line for zero or invalid amounts", () => {
  for (const amount of [0, Number.NaN]) {
    const text = describeTransaction(row({ type: "rob_blocked", amount }), withoutEmoji);
    assert.equal(text, "<t:1700000000:f> — Roubo bloqueado por proteção");
  }
});

test("the note line is shown only when the action does not already use the note", () => {
  const shown = describeTransaction(row({ type: "bet_win", amount: 5, note: "Cara ou coroa" }), withoutEmoji);
  assert.ok(shown.endsWith("\n> Cara ou coroa"));

  const hidden = describeTransaction(row({ type: "work", amount: 5, note: "Dev" }), withoutEmoji);
  assert.ok(!hidden.includes("> Dev"));
});

test("an invalid createdAt does not produce a broken timestamp", () => {
  for (const createdAt of [Number.NaN, null as unknown as number]) {
    const text = describeTransaction(row({ createdAt }), withoutEmoji);
    assert.ok(text.startsWith("Data desconhecida — "), String(createdAt));
  }
});

test("totalPages is at least one and rounds up", () => {
  assert.equal(totalPages(0), 1);
  assert.equal(totalPages(PAGE_SIZE), 1);
  assert.equal(totalPages(PAGE_SIZE + 1), 2);
  assert.equal(totalPages(Number.NaN), 1);
});

test("clampPage keeps the page inside the range", () => {
  assert.equal(clampPage(-1, 3), 0);
  assert.equal(clampPage(1, 3), 1);
  assert.equal(clampPage(5, 3), 2);
  assert.equal(clampPage(Number.NaN, 3), 0);
  assert.equal(clampPage(1.9, 3), 1);
});

test("history button ids round-trip", () => {
  const id = historyButtonId("next", OWNER_ID, 4);
  assert.equal(id, `transacoes|next|${OWNER_ID}|4`);
  assert.deepEqual(parseHistoryButtonId(id), { direction: "next", ownerId: OWNER_ID, page: 4 });
});

test("parseHistoryButtonId rejects malformed ids", () => {
  const malformed = [
    "",
    "transacoes",
    "transacoes|next",
    "transacoes|sideways|1|0",
    "transacoes|next||0",
    "transacoes|next|1|abc",
    "transacoes|next|1|-1",
    "transacoes|next|1|",
  ];
  for (const id of malformed) {
    assert.equal(parseHistoryButtonId(id), null, id);
  }
});

test("targetPage moves one page in the clicked direction", () => {
  assert.equal(targetPage({ direction: "next", ownerId: OWNER_ID, page: 2 }), 3);
  assert.equal(targetPage({ direction: "prev", ownerId: OWNER_ID, page: 2 }), 1);
});