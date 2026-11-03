// Regras puras e determinísticas dos minijogos. Sem Discord.js nem banco de dados,
// para que possam ser testadas de forma isolada. Mantenha estas funções livres de
// efeitos colaterais: qualquer sorteio recebe a fonte de aleatoriedade por parâmetro.

export type JokenpoMove = "pedra" | "papel" | "tesoura";
export type DuelWinner = "challenger" | "opponent" | "draw";

export interface JokenpoMoveInfo {
  label: string;
  emoji: string;
  icon: string;
  beats: JokenpoMove;
}

export const JOKENPO_MOVES: Record<JokenpoMove, JokenpoMoveInfo> = {
  pedra: { label: "Pedra", emoji: "🪨", icon: "rock", beats: "tesoura" },
  papel: { label: "Papel", emoji: "📄", icon: "paper", beats: "pedra" },
  tesoura: { label: "Tesoura", emoji: "✂️", icon: "scissors", beats: "papel" },
};

/** "challenger" venceu, "opponent" venceu, ou "draw". */
export function jokenpoWinner(first: JokenpoMove, second: JokenpoMove): DuelWinner {
  if (first === second) return "draw";
  return JOKENPO_MOVES[first].beats === second ? "challenger" : "opponent";
}

export type TicTacToeMark = "x" | "o";
export type TicTacToeCell = TicTacToeMark | null;

export const TIC_TAC_TOE_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function ticTacToeWinningLine(board: readonly TicTacToeCell[]): readonly [number, number, number] | null {
  for (const line of TIC_TAC_TOE_LINES) {
    const mark = board[line[0]];
    if (mark !== null && mark === board[line[1]] && mark === board[line[2]]) return line;
  }
  return null;
}

export function ticTacToeWinner(board: readonly TicTacToeCell[]): TicTacToeMark | null {
  const line = ticTacToeWinningLine(board);
  return line ? board[line[0]] : null;
}

export function ticTacToeIsFull(board: readonly TicTacToeCell[]): boolean {
  return board.every((cell) => cell !== null);
}

export type CoinSide = "cara" | "coroa";

export function flipCoinSide(random: () => number = Math.random): CoinSide {
  return random() < 0.5 ? "cara" : "coroa";
}

export function oppositeSide(side: CoinSide): CoinSide {
  return side === "cara" ? "coroa" : "cara";
}

// Combinatória exata: C(n, k), estável para os valores usados nos minijogos.
export function combinations(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || n < 0) return 0;
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n / 2) k = n - k;
  let result = 1;
  for (let index = 1; index <= k; index += 1) {
    result = (result * (n - index + 1)) / index;
  }
  return result;
}

// Roleta-russa: revólver de 6 câmaras e probabilidade condicional sem reposição
// (o tambor não é re-girado: 1/6 -> 1/5 -> 1/4 -> ... a cada câmara vazia).
export const ROULETTE_CHAMBERS = 6;
export const ROULETTE_HOUSE_EDGE = 0.05;
// Vitória contra o bot: 1/P(sobreviver) = 2, com a taxa da casa de 5% => 1.9x.
export const ROULETTE_DUEL_MULTIPLIER = (1 / 0.5) * (1 - ROULETTE_HOUSE_EDGE);

export function rouletteChancePercent(chamber: number): number {
  const remaining = ROULETTE_CHAMBERS - Math.max(0, Math.floor(chamber));
  if (remaining <= 0) return 100;
  return Math.round((1 / remaining) * 100);
}

export function rouletteEstimatedPayout(stake: number, safePulls: number): number {
  const pulls = Math.max(0, Math.floor(safePulls));
  if (pulls === 0) return Math.max(0, Math.floor(stake));
  // Sem re-giro: P(sobreviver a k puxadas) = (6-k)/6.
  // Prêmio justo = inverso dessa probabilidade; aplica-se a taxa de 5% da casa.
  const remaining = Math.max(1, ROULETTE_CHAMBERS - pulls);
  const fairMultiplier = ROULETTE_CHAMBERS / remaining;
  return Math.floor(stake * fairMultiplier * (1 - ROULETTE_HOUSE_EDGE));
}

// Raspadinha: tabela de frequência para RTP exato de 93% (a casa retém 7%).
// P(vitória) necessária = RTP / (prêmio / preço) = 0.93 / (10000/500) = 0.0465.
// Com k cookies no grid, P = C(k,3)/C(9,3): 4 cookies => 4/84, 3 cookies => 1/84.
// 4p + (1-p) = 84 * 0.0465 => p = 0.96866..., arredondado para 0.9687.
export const SCRATCH_FOUR_COOKIE_PROBABILITY = 0.9687;

export function scratchWinProbability(cookieCount: number): number {
  if (!Number.isInteger(cookieCount) || cookieCount < 3) return 0;
  return combinations(cookieCount, 3) / combinations(9, 3);
}

export function scratchExpectedRtpPercent(
  price = 500,
  prize = 10_000,
): number {
  const winProbability =
    SCRATCH_FOUR_COOKIE_PROBABILITY * scratchWinProbability(4) +
    (1 - SCRATCH_FOUR_COOKIE_PROBABILITY) * scratchWinProbability(3);
  return 100 * winProbability * (prize / price);
}

/** Sorteia quantos cookies o bilhete terá, mantendo o RTP de 93% a longo prazo. */
export function rollScratchCookieCount(random: () => number = Math.random): 3 | 4 {
  return random() < SCRATCH_FOUR_COOKIE_PROBABILITY ? 4 : 3;
}

// ─── Economia ativa: /trabalhar e /roubar ──────────────────────────────────────

// Trabalho: 80% de sucesso e 20% de demissão.
export const WORK_SUCCESS_CHANCE = 0.8;
// Ganho com distribuição normal: média ~2.200 dentro de [1.500, 3.000].
export const WORK_REWARD_MIN = 1_500;
export const WORK_REWARD_MAX = 3_000;
export const WORK_REWARD_MEAN = 2_200;
// Prejuízo da demissão: uniforme entre 500 e 2.500.
export const WORK_LOSS_MIN = 500;
export const WORK_LOSS_MAX = 2_500;

// Roubo: 40% de sucesso (vantagem para a casa/segurança pública).
export const ROB_SUCCESS_CHANCE = 0.4;
export const ROB_STEAL_MIN_PCT = 10;
export const ROB_STEAL_MAX_PCT = 25;
// Fiança/multa de 1.500 a 4.000 quando a tentativa falha.
export const ROB_PENALTY_MIN = 1_500;
export const ROB_PENALTY_MAX = 4_000;
export const ROB_MIN_TARGET_BALANCE = 100;

/**
 * Amostra de distribuição normal (Box-Muller) truncada em [min, max].
 * Concentra os resultados perto de `mean`, tornando os extremos raros e
 * evitando picos de inflação na economia.
 */
export function normalRandom(
  min: number,
  max: number,
  mean: number,
  random: () => number = Math.random,
): number {
  const sigma = (max - min) / 6;
  let sample: number;
  do {
    const u1 = Math.max(random(), Number.EPSILON);
    const u2 = random();
    sample = mean + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
  } while (sample < min || sample > max);
  return sample;
}

/** Inteiro uniforme em [min, max] (inclusivo). */
export function uniformRandomInt(
  min: number,
  max: number,
  random: () => number = Math.random,
): number {
  return Math.floor(min + random() * (max - min + 1));
}



// Aposta contra a banca.
export const HOUSE_WIN_CHANCE_PERCENT = 46;
export const HOUSE_PAYOUT_MULTIPLIER = 2;

/** `roll` é um número em [0, 100); abaixo de HOUSE_WIN_CHANCE_PERCENT é vitória. */
export function betAgainstHouseOutcome(roll: number): "win" | "loss" {
  return roll < HOUSE_WIN_CHANCE_PERCENT ? "win" : "loss";
}

export function betAgainstHousePayout(outcome: "win" | "loss", amount: number): number {
  return outcome === "win" ? amount * HOUSE_PAYOUT_MULTIPLIER : 0;
}

// Boxe: narrativa de rounds com resultado agregado.
export type Boxer = "challenger" | "opponent";

export interface BoxingRoundResult {
  round: number;
  winner: Boxer;
}

export interface BoxingMatchResult {
  rounds: BoxingRoundResult[];
  winner: Boxer;
  loser: Boxer;
  challengerRounds: number;
  opponentRounds: number;
}

/**
 * Simula uma luta de melhor-de-`rounds` (padrão 3, ímpar para evitar empate).
 * Cada round é decidido pela fonte de aleatoriedade passada.
 */
export function simulateBoxingMatch(rounds = 3, random: () => number = Math.random): BoxingMatchResult {
  const results: BoxingRoundResult[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    results.push({ round, winner: random() < 0.5 ? "challenger" : "opponent" });
  }
  const challengerRounds = results.filter((entry) => entry.winner === "challenger").length;
  const opponentRounds = rounds - challengerRounds;
  const winner: Boxer = challengerRounds >= opponentRounds ? "challenger" : "opponent";
  return {
    rounds: results,
    winner,
    loser: winner === "challenger" ? "opponent" : "challenger",
    challengerRounds,
    opponentRounds,
  };
}
