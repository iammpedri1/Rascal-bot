/**
 * Lógica do minijogo Mines.
 * Calcula multiplicadores e gerencia o estado do tabuleiro.
 */

export const MINES_GRID_SIZE = 25; // 5x5 para aproveitar o limite de 5 botões por linha do Discord
export const MINES_ROWS = 5;
export const MINES_COLS = 5;

/**
 * Calcula o multiplicador para a próxima casa segura.
 * @param totalCells Total de casas no tabuleiro (ex: 25)
 * @param totalMines Total de minas escondidas
 * @param revealedDiamonds Quantos diamantes já foram encontrados
 * @returns O multiplicador acumulado após encontrar o próximo diamante
 */
export function calculateNextMultiplier(totalCells: number, totalMines: number, revealedDiamonds: number): number {
    // A probabilidade de escolher um diamante é (TotalDiamonds - Found) / (TotalAvailable)
    // Onde TotalDiamonds = totalCells - totalMines
    // E TotalAvailable = totalCells - revealedDiamonds

    const totalDiamonds = totalCells - totalMines;
    const remainingDiamonds = totalDiamonds - revealedDiamonds;
    const remainingCells = totalCells - revealedDiamonds;

    if (remainingDiamonds <= 0 || remainingCells <= 0) return 0;

    const probability = remainingDiamonds / remainingCells;

    // O multiplicador é o inverso da probabilidade, com uma pequena margem da casa (0.97 ou similar)
    const houseEdge = 0.98;
    return (1 / probability) * houseEdge;
}

/**
 * Gera as posições das minas aleatoriamente.
 * @param count Quantidade de minas a serem geradas
 */
export function generateMines(count: number): number[] {
    const positions = Array.from({ length: MINES_GRID_SIZE }, (_, i) => i);
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
}

/**
 * Cria um novo estado de jogo para o Mines.
 * @param bet Valor da aposta
 * @param mineCount Quantidade de minas
 */
export function createMinesGame(bet: number, mineCount: number): MinesState {
    return {
        mines: generateMines(mineCount),
        revealed: [],
        multiplier: 1.0,
        bet,
        mineCount,
        isGameOver: false,
        isVictory: false,
    };
}

/**
 * Revela uma célula no tabuleiro e atualiza o estado do jogo.
 * @param state Estado atual do jogo
 * @param index Índice da célula a ser revelada
 */
export function revealCell(state: MinesState, index: number): MinesState {
    if (state.isGameOver || state.revealed.includes(index)) return state;

    if (state.mines.includes(index)) {
        return { ...state, isGameOver: true, isVictory: false };
    }

    const nextMulti = calculateNextMultiplier(MINES_GRID_SIZE, state.mineCount, state.revealed.length);
    const newRevealed = [...state.revealed, index];
    const newMultiplier = state.multiplier * nextMulti;

    const isVictory = newRevealed.length === (MINES_GRID_SIZE - state.mineCount);

    return {
        ...state,
        revealed: newRevealed,
        multiplier: newMultiplier,
        isGameOver: isVictory,
        isVictory,
    };
}
