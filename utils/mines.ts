import { randomInt } from "node:crypto";

/** Tamanho lateral padrão do tabuleiro maior suportado pelo motor. */
export const MINES_GRID_SIZE = 5;
export const MINES_ROWS = 5;
export const MINES_COLS = 5;

/** RTP alvo por partida: a vantagem da casa é aplicada uma única vez. */
export const MINES_RTP = 0.98;

/**
 * Multiplicador incremental para a próxima revelação segura.
 *
 * A probabilidade é condicional: diamantes restantes / células restantes.
 * A vantagem da casa (2%) é aplicada somente na primeira revelação. Assim,
 * após k revelações, o multiplicador acumulado é 0.98 / P(sobreviver k),
 * em vez de cobrar 2% repetidamente a cada clique.
 */
export function calculateNextMultiplier(
  totalCells: number,
  totalMines: number,
  revealedDiamonds: number,
): number {
  if (
    !Number.isSafeInteger(totalCells) ||
    !Number.isSafeInteger(totalMines) ||
    !Number.isSafeInteger(revealedDiamonds) ||
    totalCells <= 0 ||
    totalMines < 1 ||
    totalMines >= totalCells ||
    revealedDiamonds < 0 ||
    revealedDiamonds >= totalCells - totalMines
  ) {
    return 0;
  }

  const totalDiamonds = totalCells - totalMines;
  const remainingDiamonds = totalDiamonds - revealedDiamonds;
  const remainingCells = totalCells - revealedDiamonds;
  if (remainingDiamonds <= 0 || remainingCells <= 0) return 0;

  const probabilityOfNextSafeCell = remainingDiamonds / remainingCells;
  const firstRevealHouseEdge = revealedDiamonds === 0 ? MINES_RTP : 1;
  return firstRevealHouseEdge / probabilityOfNextSafeCell;
}

/**
 * Escolhe posições de minas sem reposição, usando CSPRNG do Node.
 * gridSize representa o número de linhas/colunas (3 ou 5).
 */
export function generateMines(count: number, gridSize = MINES_GRID_SIZE): number[] {
  if (
    !Number.isSafeInteger(gridSize) ||
    ![3, 5].includes(gridSize) ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count >= gridSize * gridSize
  ) {
    throw new RangeError("Quantidade de minas ou tamanho de tabuleiro inválido.");
  }

  const positions = Array.from({ length: gridSize * gridSize }, (_, index) => index);

  // Fisher–Yates com randomInt: distribuição uniforme e sem posições repetidas.
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]];
  }

  return positions.slice(0, count).sort((left, right) => left - right);
}

export interface MinesState {
  mines: number[];
  revealed: number[];
  multiplier: number;
  bet: number;
  mineCount: number;
  isGameOver: boolean;
  isVictory: boolean;
  gridSize: number;
}

export function createMinesGame(bet: number, mineCount: number, gridSize = 3): MinesState {
  if (!Number.isSafeInteger(bet) || bet < 0) {
    throw new RangeError("A aposta deve ser um inteiro não negativo.");
  }
  if (![3, 5].includes(gridSize)) {
    throw new RangeError("O tabuleiro deve ser 3x3 ou 5x5.");
  }
  if (!Number.isSafeInteger(mineCount) || mineCount < 1 || mineCount >= gridSize * gridSize) {
    throw new RangeError("Quantidade de minas inválida.");
  }

  return {
    mines: generateMines(mineCount, gridSize),
    revealed: [],
    multiplier: 1,
    bet,
    mineCount,
    isGameOver: false,
    isVictory: false,
    gridSize,
  };
}

export function revealCell(state: MinesState, index: number): MinesState {
  const totalCells = state.gridSize * state.gridSize;
  if (
    state.isGameOver ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= totalCells ||
    state.revealed.includes(index)
  ) {
    return state;
  }

  if (state.mines.includes(index)) {
    return { ...state, isGameOver: true, isVictory: false };
  }

  const nextMultiplier = calculateNextMultiplier(
    totalCells,
    state.mineCount,
    state.revealed.length,
  );
  if (!(nextMultiplier > 0) || !Number.isFinite(nextMultiplier)) return state;

  const revealed = [...state.revealed, index];
  const multiplier = state.multiplier * nextMultiplier;
  const isVictory = revealed.length === totalCells - state.mineCount;

  return {
    ...state,
    revealed,
    multiplier,
    isGameOver: isVictory,
    isVictory,
  };
}