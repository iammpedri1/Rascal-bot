import type { Awaitable, ClientEvents } from "discord.js";
import type { RascalClient } from "../core/RascalClient";

export type ClientEventName = keyof ClientEvents;

export interface EventDefinition<K extends ClientEventName> {
  name: K;
  once?: boolean;
  execute(
    ...args: [...ClientEvents[K], RascalClient]
  ): Awaitable<void>;
}

export function defineEvent<K extends ClientEventName>(
  event: EventDefinition<K>,
): EventDefinition<K> {
  return event;
}
