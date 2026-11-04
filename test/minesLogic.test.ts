const assert = require("node:assert/strict");
const test = require("node:test");

const {
  generateMinesGrid,
  calculateMultiplier,
  MINES_TOTAL_CELLS,
} = require("../utils/minesLogic");

test("generateMinesGrid coloca exatamente o número pedido de minas", () => {
  for (const mineCount of [1, 3, 8, 15]) {
    const grid = generateMinesGrid(mineCount);
    const cells = grid.flat();
    const bombs = cells.filter((cell: boolean) => cell).length;
    assert.equal(cells.length, MINES_TOTAL_CELLS);
    assert.equal(bombs, mineCount);
  }
});

test("calculateMultiplier começa em 1x e cresce a cada diamante revelado", () => {
  assert.equal(calculateMultiplier(0, 3), 1);
  const first = calculateMultiplier(1, 3);
  const second = calculateMultiplier(2, 3);
  const third = calculateMultiplier(3, 3);
  assert.ok(first > 1, `primeiro clic devia pagar mais que 1x: ${first}`);
  assert.ok(second > first);
  assert.ok(third > second);
});

test("calculateMultiplier usa a fórmula hipergeométrica com house edge de 5%", () => {

  assert.ok(Math.abs(calculateMultiplier(1, 1) - (16 / 15) * 0.95) < 1e-9);

  assert.ok(Math.abs(calculateMultiplier(3, 3) - (560 / 286) * 0.95) < 1e-9);

  assert.ok(Math.abs(calculateMultiplier(1, 15) - 15.2) < 1e-9);
});

test("calculateMultiplier mantém a vantagem da casa em exatamente 5%", () => {

  for (const mineCount of [1, 3, 8, 15]) {
    const safeCells = MINES_TOTAL_CELLS - mineCount;
    const survival = safeCells / MINES_TOTAL_CELLS;
    assert.ok(Math.abs(survival * calculateMultiplier(1, mineCount) - 0.95) < 1e-9);
  }
});

test("calculateMultiplier recompensa mais por tabuleiros com mais minas", () => {
  assert.ok(calculateMultiplier(1, 5) > calculateMultiplier(1, 3));
  assert.ok(calculateMultiplier(2, 8) > calculateMultiplier(2, 5));
});
