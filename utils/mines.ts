export const MINES_GRID_SIZE = 25;
export const MINES_ROWS = 5;
export const MINES_COLS = 5;

export function calculateNextMultiplier(totalCells: number, totalMines: number, revealedDiamonds: number): number {
    if (
        !Number.isSafeInteger(totalCells) ||
        !Number.isSafeInteger(totalMines) ||
        !Number.isSafeInteger(revealedDiamonds) ||
        totalCells <= 0 ||
        totalMines < 1 ||
        totalMines >= totalCells ||
        revealedDiamonds < 0 ||
        revealedDiamonds >= totalCells - totalMines
    ) return 0;

    const totalDiamonds = totalCells - totalMines;
    const remainingDiamonds = totalDiamonds - revealedDiamonds;
    const remainingCells = totalCells - revealedDiamonds;

    if (remainingDiamonds <= 0 || remainingCells <= 0) return 0;

    const probability = remainingDiamonds / remainingCells;
    const houseEdge = 0.98;

    return (1 / probability) * houseEdge;
}

export function generateMines(count: number, gridSize = MINES_GRID_SIZE): number[] {
    if (!Number.isSafeInteger(gridSize) || gridSize < 1 || !Number.isSafeInteger(count) || count < 0 || count >= gridSize * gridSize) {
        throw new RangeError("Quantidade de minas ou tamanho de tabuleiro inválido.");
    }

    const positions = Array.from({ length: gridSize * gridSize }, (_, i) => i);
    const mines: number[] = [];

    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * positions.length);
        mines.push(positions.splice(randomIndex, 1)[0]);
    }

    return mines;
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

export function createMinesGame(bet: number, mineCount: number, gridSize = 5): MinesState {
    const safeGridSize = gridSize === 3 ? 3 : 5;
    if (!Number.isSafeInteger(bet) || bet < 0) throw new RangeError("A aposta deve ser um inteiro não negativo.");
    if (!Number.isSafeInteger(mineCount) || mineCount < 1 || mineCount >= safeGridSize * safeGridSize) {
        throw new RangeError("Quantidade de minas inválida.");
    }
    return {
        mines: generateMines(mineCount, safeGridSize),
        revealed: [],
        multiplier: 1.0,
        bet,
        mineCount,
        isGameOver: false,
        isVictory: false,
        gridSize: safeGridSize,
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
    ) return state;

    if (state.mines.includes(index)) {
        return { ...state, isGameOver: true, isVictory: false };
    }

    const nextMulti = calculateNextMultiplier(totalCells, state.mineCount, state.revealed.length);
    const newRevealed = [...state.revealed, index];
    const newMultiplier = state.multiplier * nextMulti;

    const isVictory = newRevealed.length === (totalCells - state.mineCount);

    return {
        ...state,
        revealed: newRevealed,
        multiplier: newMultiplier,
        isGameOver: isVictory,
        isVictory,
    };
}