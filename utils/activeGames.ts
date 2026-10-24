/** Keeps each user in at most one live minigame in this bot process. */
export class ActiveGamesManager {
  private readonly users = new Map<string, string>();

  reserveNew(userIds: readonly string[], gameId: string): boolean {
    const uniqueUserIds = [...new Set(userIds.map(String))];
    if (uniqueUserIds.length !== userIds.length) return false;
    if (uniqueUserIds.some((userId) => this.users.has(userId))) return false;

    for (const userId of uniqueUserIds) this.users.set(userId, gameId);
    return true;
  }

  join(userId: string, gameId: string): boolean {
    const currentGameId = this.users.get(String(userId));
    if (currentGameId && currentGameId !== gameId) return false;
    this.users.set(String(userId), gameId);
    return true;
  }

  owns(userId: string, gameId: string): boolean {
    return this.users.get(String(userId)) === gameId;
  }

  gameFor(userId: string): string | undefined {
    return this.users.get(String(userId));
  }

  releaseUser(userId: string, gameId: string): void {
    if (this.users.get(String(userId)) === gameId) this.users.delete(String(userId));
  }

  releaseGame(gameId: string): void {
    for (const [userId, activeGameId] of this.users) {
      if (activeGameId === gameId) this.users.delete(userId);
    }
  }
}

export const activeGames = new ActiveGamesManager();
