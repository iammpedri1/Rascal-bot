import { randomInt } from "node:crypto";
import { combinations } from "./gameRules";

export type MinesGrid = boolean[][]; // true = bomba, false = diamante

export const MINES_BOARD_SIZE = 4;
export const MINES_TOTAL_CELLS = MINES_BOARD_SIZE * MINES_BOARD_SIZE;
export const MINES_HOUSE_EDGE = 0.05;

/** Distribui `mineCount` bombas de forma puramente aleatória no tabuleiro 4x4. */
export function generateMinesGrid(mineCount: number): MinesGrid {
  const grid: MinesGrid = Array.from({ length: MINES_BOARD_SIZE }, () =>
    Array<boolean>(MINES_BOARD_SIZE).fill(false),
  );
  let placed = 0;
  while (placed < mineCount) {
    const row = randomInt(0, MINES_BOARD_SIZE);
    const column = randomInt(0, MINES_BOARD_SIZE);
    if (!grid[row][column]) {
      grid[row][column] = true;
      placed += 1;
    }
  }
  return grid;
}

/**
 * Multiplicador hipergeométrico do Mines.
 *   Combinações_Iniciais = C(Total_Células, Total_Minas)
 *   Combinações_Atuais  = C(Células_Restantes, Minas_Restantes)
 *   Multiplicador = (Combinações_Iniciais / Combinações_Atuais) * (1 - House_Edge)
 *
 * Como as minas evitam as células já reveladas, a razão entre as combinações é
 * exatamente o inverso da probabilidade de ter sobrevivido a `picks` cliques,
 * o que garante vantagem matemática de exatamente 5% para a casa.
 */
export function calculateMultiplier(picks: number, mineCount: number): number {
  const reveals = Math.max(0, Math.floor(picks));
  if (reveals === 0) return 1;

  const remainingCells = MINES_TOTAL_CELLS - reveals;
  const initialCombinations = combinations(MINES_TOTAL_CELLS, mineCount);
  const currentCombinations = combinations(remainingCells, mineCount);
  if (currentCombinations <= 0) return Number.POSITIVE_INFINITY;

  return (initialCombinations / currentCombinations) * (1 - MINES_HOUSE_EDGE);
}
