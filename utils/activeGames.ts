/** Keeps each user in at most one live minigame in this bot process. */
export class ActiveGamesManager {
  private readonly users = new Map<string, { gameId: string; type: string; startedAt: number }>();

  reserveNew(userIds: readonly string[], gameId: string, type: string = "generic"): boolean {
    const uniqueUserIds = [...new Set(userIds.map(String))];
    if (uniqueUserIds.length !== userIds.length) return false;
    if (uniqueUserIds.some((userId) => this.users.has(userId))) return false;

    for (const userId of uniqueUserIds) {
      this.users.set(userId, { gameId, type, startedAt: Date.now() });
    }
    return true;
  }

  join(userId: string, gameId: string, type: string = "generic"): boolean {
    const currentGame = this.users.get(String(userId));
    if (currentGame && currentGame.gameId !== gameId) return false;
    this.users.set(String(userId), { gameId, type, startedAt: Date.now() });
    return true;
  }

  owns(userId: string, gameId: string): boolean {
    const game = this.users.get(String(userId));
    return game?.gameId === gameId;
  }

  gameFor(userId: string) {
    return this.users.get(String(userId));
  }

  releaseUser(userId: string, gameId: string): void {
    const game = this.users.get(String(userId));
    if (game?.gameId === gameId) this.users.delete(String(userId));
  }

  releaseGame(gameId: string): void {
    for (const [userId, game] of this.users) {
      if (game.gameId === gameId) this.users.delete(userId);
    }
  }
}

export const activeGames = new ActiveGamesManager();
