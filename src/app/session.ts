import type { Session, Battle } from "../shared/types";
import { clone } from "../shared/document";
import { createMap, DEFAULT_HEIGHT, DEFAULT_WIDTH } from "../features/terrain";
import { createUnits } from "../features/roster";
import { order } from "../features/initiative";
export function newSession(): Session {
  const live: Battle = {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    tiles: createMap(DEFAULT_WIDTH, DEFAULT_HEIGHT),
    units: createUnits(),
    round: 1,
    queue: [],
    active: "",
    ended: null,
  };
  live.queue = order(live);
  live.active = live.queue[0];
  return { initial: clone(live), live, events: [] };
}
