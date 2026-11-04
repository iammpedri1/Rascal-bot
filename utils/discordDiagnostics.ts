const recentCommands = new Map<string, { command: string; at: number }>();
const ROUTE_TTL_MS = 60_000;

export function recordDiscordCommand(command: string): void {
  recentCommands.set(command, { command, at: Date.now() });
}

export function latestDiscordCommand(): string | null {
  const now = Date.now();
  for (const [key, value] of recentCommands) {
    if (now - value.at > ROUTE_TTL_MS) recentCommands.delete(key);
  }
  const latest = [...recentCommands.values()].sort((a, b) => b.at - a.at)[0];
  return latest?.command ?? null;
}
