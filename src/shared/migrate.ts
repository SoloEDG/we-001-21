import type { Battle, BattleEvent, Session, Tile } from "./types";
import { tileTerrain } from "../features/terrain/model/map";
import { onField } from "./document";
const DEFAULT_WIDTH = 12;
const DEFAULT_HEIGHT = 8;

function normalizeBattle(raw: Battle): Battle {
  if (!raw || !Array.isArray(raw.tiles) || !Array.isArray(raw.units))
    throw new Error("战斗数据缺失");
  let width = raw.width,
    height = raw.height;
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    // 旧档没有尺寸字段：原始战场固定为 12 × 8，若坐标超出则按边界扩展，
    // 并补齐缺失的格子。
    const maxX = Math.max(...raw.tiles.map((t) => t.x)),
      maxY = Math.max(...raw.tiles.map((t) => t.y));
    width = Math.max(DEFAULT_WIDTH, maxX + 1);
    height = Math.max(DEFAULT_HEIGHT, maxY + 1);
  }
  const existing = new Map(raw.tiles.map((t) => [`${t.x},${t.y}`, t.terrain]));
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      tiles.push({
        x,
        y,
        terrain: existing.get(`${x},${y}`) ?? tileTerrain(x, y),
      });
  const units = raw.units.map((u) => ({
    ...u,
    deployed: typeof u.deployed === "boolean" ? u.deployed : true,
    statuses: Array.isArray(u.statuses) ? u.statuses : [],
  }));
  for (const u of units) {
    if (!u.deployed) continue;
    if (
      u.x < 0 ||
      u.y < 0 ||
      u.x >= width ||
      u.y >= height
    )
      u.deployed = false;
  }
  const battle: Battle = {
    ...raw,
    width,
    height,
    tiles,
    units,
    queue: Array.isArray(raw.queue) ? [...raw.queue] : [],
    ended: raw.ended ?? null,
  };
  if (!battle.queue.length) {
    battle.queue = onField(battle)
      .sort((a, c) => c.speed - a.speed || a.id.localeCompare(c.id))
      .map((u) => u.id);
    battle.active = battle.queue[0] ?? "";
  }
  if (battle.active && !battle.queue.includes(battle.active))
    battle.active = battle.queue[0] ?? "";
  // 旧档的当前角色若已死亡，从队列中移除并顺位；不动快照的回合数，
  // 避免历史回放被迁移逻辑改写。
  battle.queue = battle.queue.filter((id) => {
    const u = battle.units.find((v) => v.id === id);
    return u && u.hp > 0 && u.deployed;
  });
  if (battle.active && !battle.queue.includes(battle.active))
    battle.active = battle.queue[0] ?? "";
  return battle;
}

/**
 * 读取旧档时补齐尺寸字段。历史事件中的快照各自保留记录当时的尺寸，
 * 不会被当前缩图裁切。
 */
export function migrateSession(raw: Session): Session {
  const initial = normalizeBattle(raw.initial);
  const live = normalizeBattle(raw.live);
  const events: BattleEvent[] = (raw.events ?? []).map((e) => ({
    ...e,
    path: Array.isArray(e.path) ? e.path : [],
    before: normalizeBattle(e.before),
    after: normalizeBattle(e.after),
  }));
  return { initial, live, events };
}
