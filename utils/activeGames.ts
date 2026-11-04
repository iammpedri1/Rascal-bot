/** Keeps each user in at most one live minigame in this bot process. */
export const STALE_GAME_TIMEOUT_MS = 2 * 60 * 1000;

interface ActiveGame {
  gameId: string;
  lastActivityAt: number;
}

export class ActiveGamesManager {
  private readonly users = new Map<string, ActiveGame>();

  private removeStaleGames(now = Date.now()): void {
    for (const [userId, game] of this.users) {
      if (now - game.lastActivityAt >= STALE_GAME_TIMEOUT_MS) {
        this.users.delete(userId);
      }
    }
  }

  reserveNew(userIds: readonly string[], gameId: string): boolean {
    this.removeStaleGames();
    const uniqueUserIds = [...new Set(userIds.map(String))];
    if (uniqueUserIds.length !== userIds.length) return false;
    if (uniqueUserIds.some((userId) => this.users.has(userId))) return false;

    const activeGame = { gameId, lastActivityAt: Date.now() };
    for (const userId of uniqueUserIds) this.users.set(userId, activeGame);
    return true;
  }

  join(userId: string, gameId: string): boolean {
    this.removeStaleGames();
    const currentGame = this.users.get(String(userId));
    if (currentGame && currentGame.gameId !== gameId) return false;
    this.users.set(String(userId), {
      gameId,
      lastActivityAt: Date.now(),
    });
    return true;
  }

  owns(userId: string, gameId: string): boolean {
    this.removeStaleGames();
    const game = this.users.get(String(userId));
    if (!game || game.gameId !== gameId) return false;
    game.lastActivityAt = Date.now();
    return true;
  }

  gameFor(userId: string): string | undefined {
    this.removeStaleGames();
    return this.users.get(String(userId))?.gameId;
  }

  releaseUser(userId: string, gameId: string): void {
    if (this.users.get(String(userId))?.gameId === gameId) this.users.delete(String(userId));
  }

  releaseGame(gameId: string): void {
    for (const [userId, game] of this.users) {
      if (game.gameId === gameId) this.users.delete(userId);
    }
  }
}

export const activeGames = new ActiveGamesManager();
