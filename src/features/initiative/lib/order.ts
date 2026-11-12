import type { Battle } from "../../../shared/types";
import { living, onField } from "../../../shared/document";
export function order(b: Battle) {
  return onField(b)
    .sort((a, c) => c.speed - a.speed || a.id.localeCompare(c.id))
    .map((u) => u.id);
}
export function outcome(b: Battle) {
  const teams = new Set(living(b).map((u) => u.team));
  return teams.size <= 1 ? (teams.values().next().value ?? "draw") : null;
}
