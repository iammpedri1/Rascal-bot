const assert = require("node:assert/strict");
const test = require("node:test");

const {
  jokenpoWinner,
  ticTacToeWinner,
  ticTacToeWinningLine,
  ticTacToeIsFull,
  flipCoinSide,
  oppositeSide,
  combinations,
  rouletteChancePercent,
  rouletteEstimatedPayout,
  ROULETTE_DUEL_MULTIPLIER,
  scratchWinProbability,
  scratchExpectedRtpPercent,
  rollScratchCookieCount,
  betAgainstHouseOutcome,
  betAgainstHousePayout,
  HOUSE_WIN_CHANCE_PERCENT,
  HOUSE_PAYOUT_MULTIPLIER,
  simulateBoxingMatch,
  normalRandom,
  uniformRandomInt,
  WORK_SUCCESS_CHANCE,
  WORK_REWARD_MIN,
  WORK_REWARD_MAX,
  WORK_REWARD_MEAN,
  WORK_LOSS_MIN,
  WORK_LOSS_MAX,
  ROB_SUCCESS_CHANCE,
  ROB_STEAL_MIN_PCT,
  ROB_STEAL_MAX_PCT,
  ROB_PENALTY_MIN,
  ROB_PENALTY_MAX,
} = require("../utils/gameRules");

test("jokenpoWinner resolve pedra, papel e tesoura corretamente", () => {
  assert.equal(jokenpoWinner("pedra", "tesoura"), "challenger");
  assert.equal(jokenpoWinner("tesoura", "pedra"), "opponent");
  assert.equal(jokenpoWinner("papel", "pedra"), "challenger");
  assert.equal(jokenpoWinner("tesoura", "papel"), "challenger");
  assert.equal(jokenpoWinner("pedra", "papel"), "opponent");
  assert.equal(jokenpoWinner("pedra", "pedra"), "draw");
});

test("ticTacToeWinner encontra linha, coluna e diagonal", () => {
  assert.equal(ticTacToeWinner(["x", "x", "x", null, null, null, null, null, null]), "x");
  assert.equal(ticTacToeWinner([null, null, "o", null, null, "o", null, null, "o"]), "o");
  assert.equal(ticTacToeWinner(["x", null, null, null, "x", null, null, null, "x"]), "x");
  assert.equal(ticTacToeWinner(["x", "o", "x", "o", "x", "o", "o", "x", "o"]), null);
});

test("ticTacToeWinningLine devolve a linha vencedora e null quando não há", () => {
  assert.deepEqual(ticTacToeWinningLine([null, null, "o", null, null, "o", null, null, "o"]), [2, 5, 8]);
  assert.equal(ticTacToeWinningLine(["x", "o", "x", "o", "x", "o", "o", "x", "o"]), null);
});

test("ticTacToeIsFull só é verdadeiro com o tabuleiro completo", () => {
  assert.equal(ticTacToeIsFull(["x", "o", "x", "o", "x", "o", "o", "x", "o"]), true);
  assert.equal(ticTacToeIsFull(["x", null, "x", "o", "x", "o", "o", "x", "o"]), false);
});

test("flipCoinSide respeita a fonte de aleatoriedade", () => {
  assert.equal(flipCoinSide(() => 0.1), "cara");
  assert.equal(flipCoinSide(() => 0.9), "coroa");
  assert.equal(oppositeSide("cara"), "coroa");
  assert.equal(oppositeSide("coroa"), "cara");
});

test("rouletteChancePercent cobre desde a primeira câmara até a última", () => {
  assert.equal(rouletteChancePercent(0), 17);
  assert.equal(rouletteChancePercent(1), 20);
  assert.equal(rouletteChancePercent(5), 100);
  assert.equal(rouletteChancePercent(6), 100);
});

test("rouletteEstimatedPayout usa a probabilidade condicional com taxa da casa de 5%", () => {
  assert.equal(rouletteEstimatedPayout(1000, 0), 1000);
  assert.equal(rouletteEstimatedPayout(1000, 1), 1140); // 1000 * 6/5 * 0.95
  assert.equal(rouletteEstimatedPayout(1000, 2), 1425); // 1000 * 6/4 * 0.95
  assert.equal(rouletteEstimatedPayout(1000, 3), 1900); // 1000 * 6/3 * 0.95
  assert.equal(rouletteEstimatedPayout(1000, 4), 2850); // 1000 * 6/2 * 0.95
  assert.equal(rouletteEstimatedPayout(1000, 5), 5700); // 1000 * 6/1 * 0.95
  assert.equal(ROULETTE_DUEL_MULTIPLIER, 1.9);
});

test("combinations calcula a combinatória exata", () => {
  assert.equal(combinations(16, 1), 16);
  assert.equal(combinations(16, 15), 16);
  assert.equal(combinations(16, 3), 560);
  assert.equal(combinations(9, 3), 84);
  assert.equal(combinations(9, 4), 126);
  assert.equal(combinations(5, 7), 0);
});

test("scratchWinProbability segue C(k,3)/C(9,3)", () => {
  assert.ok(Math.abs(scratchWinProbability(3) - 1 / 84) < 1e-12);
  assert.ok(Math.abs(scratchWinProbability(4) - 4 / 84) < 1e-12);
  assert.equal(scratchWinProbability(2), 0);
});

test("scratchExpectedRtpPercent fica em exatamente 93% com a tabela de pesos", () => {
  const rtp = scratchExpectedRtpPercent();
  assert.ok(rtp >= 92.9 && rtp <= 93.1, `RTP fora da faixa de 93%: ${rtp}`);
});

test("rollScratchCookieCount respeita a fonte de aleatoriedade", () => {
  assert.equal(rollScratchCookieCount(() => 0.5), 4);
  assert.equal(rollScratchCookieCount(() => 0.99), 3);
});

test("normalRandom respeita os limites e concentra valores perto da média", () => {
  for (let index = 0; index < 200; index += 1) {
    const value = normalRandom(1500, 3000, 2200);
    assert.ok(value >= 1500 && value <= 3000, `fora do intervalo: ${value}`);
  }

  const samples = Array.from({ length: 20_000 }, () => normalRandom(1500, 3000, 2200));
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  assert.ok(mean > 2150 && mean < 2250, `média fora do esperado: ${mean}`);

  const nearMean = samples.filter(value => Math.abs(value - 2200) <= 200).length;
  const nearEdges = samples.filter(value => value - 1500 <= 100 || 3000 - value <= 100).length;
  assert.ok(nearMean > nearEdges, `valores extremos frequentes demais: centro ${nearMean}, bordas ${nearEdges}`);
});

test("uniformRandomInt devolve inteiros dentro do intervalo", () => {
  assert.equal(uniformRandomInt(500, 2500, () => 0), 500);
  assert.equal(uniformRandomInt(500, 2500, () => 0.999999), 2500);
  for (let index = 0; index < 200; index += 1) {
    const value = uniformRandomInt(10, 25);
    assert.ok(Number.isInteger(value) && value >= 10 && value <= 25);
  }
});

test("constantes de balanceamento de trabalho e roubo seguem a especificação", () => {
  assert.equal(WORK_SUCCESS_CHANCE, 0.8);
  assert.equal(WORK_REWARD_MIN, 1500);
  assert.equal(WORK_REWARD_MAX, 3000);
  assert.equal(WORK_REWARD_MEAN, 2200);
  assert.equal(WORK_LOSS_MIN, 500);
  assert.equal(WORK_LOSS_MAX, 2500);

  assert.equal(ROB_SUCCESS_CHANCE, 0.4);
  assert.equal(ROB_STEAL_MIN_PCT, 10);
  assert.equal(ROB_STEAL_MAX_PCT, 25);
  assert.equal(ROB_PENALTY_MIN, 1500);
  assert.equal(ROB_PENALTY_MAX, 4000);
});

test("betAgainstHouseOutcome usa a chance configurada e paga o dobro na vitória", () => {
  assert.equal(betAgainstHouseOutcome(HOUSE_WIN_CHANCE_PERCENT - 1), "win");
  assert.equal(betAgainstHouseOutcome(HOUSE_WIN_CHANCE_PERCENT), "loss");
  assert.equal(betAgainstHousePayout("win", 300), 300 * HOUSE_PAYOUT_MULTIPLIER);
  assert.equal(betAgainstHousePayout("loss", 300), 0);
});

test("simulateBoxingMatch produz rounds suficientes e um vencedor coerente", () => {
  const result = simulateBoxingMatch(3, () => 0.1);
  assert.equal(result.rounds.length, 3);
  assert.equal(result.winner, "challenger");
  assert.equal(result.loser, "opponent");
  assert.equal(result.challengerRounds, 3);
  assert.equal(result.opponentRounds, 0);
});
