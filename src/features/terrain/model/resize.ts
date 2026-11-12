import type { Battle, Point, Tile, Unit } from "../../../shared/types";
import {
  clone,
  findUnit,
  key,
  pending,
  tileAt,
  unitAt,
} from "../../../shared/document";
import { beginRound, syncTurnState } from "../../initiative/model/turns";
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  MAX_SIZE,
  MIN_SIZE,
  tileTerrain,
} from "./map";
import { movementCost, terrainRules } from "../lib/cost";

export type ResizeAnchor = "center" | "left" | "right" | "top" | "bottom";
export const anchors: ResizeAnchor[] = [
  "center",
  "left",
  "right",
  "top",
  "bottom",
];
export const anchorNames: Record<ResizeAnchor, string> = {
  center: "中心",
  left: "左边",
  right: "右边",
  top: "上边",
  bottom: "下边",
};
export const anchorNotes: Record<ResizeAnchor, string> = {
  center: "四周对称裁切 / 扩展",
  left: "左边缘固定，右侧收放",
  right: "右边缘固定，左侧收放",
  top: "上边缘固定，底部收放",
  bottom: "下边缘固定，顶部收放",
};
export interface ResizeDraft {
  width: number;
  height: number;
  anchor: ResizeAnchor;
}
export interface ResizeUnitPreview {
  id: string;
  name: string;
  team: Unit["team"];
  job: Unit["job"];
  hp: number;
  maxHp: number;
  from: Point;
  to: Point;
  deployed: boolean;
  lost: boolean;
}
export interface ResizePlan {
  width: number;
  height: number;
  anchor: ResizeAnchor;
  /** 新地图左上角对应的旧地图坐标，扩大时为负值。 */
  sx: number;
  sy: number;
  tiles: Tile[];
  units: ResizeUnitPreview[];
  lostUnits: ResizeUnitPreview[];
  /** 当前地图中将被裁掉的地形格。 */
  lostTiles: string[];
  keptTileCount: number;
  lostTileCount: number;
  addedTileCount: number;
  changed: boolean;
}
export function clampSize(n: unknown, fallback = DEFAULT_WIDTH) {
  const value = Math.round(Number(n));
  return Number.isFinite(value)
    ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, value))
    : fallback;
}
function offset(
  oldSize: number,
  newSize: number,
  align: "start" | "end" | "center",
) {
  if (align === "start") return 0;
  if (align === "end") return oldSize - newSize;
  return Math.round((oldSize - newSize) / 2);
}
function windowFor(
  oldSize: number,
  newSize: number,
  anchor: ResizeAnchor,
  axis: "x" | "y",
) {
  if (axis === "x")
    return offset(
      oldSize,
      newSize,
      anchor === "left" ? "start" : anchor === "right" ? "end" : "center",
    );
  return offset(
    oldSize,
    newSize,
    anchor === "top" ? "start" : anchor === "bottom" ? "end" : "center",
  );
}
/** 只读计算，用于预览；不会修改战场。 */
export function planResize(b: Battle, draft: ResizeDraft): ResizePlan {
  const width = clampSize(draft.width, b.width);
  const height = clampSize(draft.height, b.height);
  const anchor = anchors.includes(draft.anchor) ? draft.anchor : "center";
  const sx = windowFor(b.width, width, anchor, "x");
  const sy = windowFor(b.height, height, anchor, "y");
  const oldByKey = new Map(b.tiles.map((t) => [key(t), t.terrain]));
  const tiles: Tile[] = [];
  const lostTiles: string[] = [];
  let keptTileCount = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const terrain = oldByKey.get(`${x + sx},${y + sy}`);
      if (terrain) keptTileCount++;
      tiles.push({ x, y, terrain: terrain ?? tileTerrain(x, y) });
    }
  for (const t of b.tiles)
    if (t.x < sx || t.x >= sx + width || t.y < sy || t.y >= sy + height)
      lostTiles.push(key(t));
  const units: ResizeUnitPreview[] = b.units
    .filter((u) => u.hp > 0)
    .map((u) => {
      if (!u.deployed)
        return {
          id: u.id,
          name: u.name,
          team: u.team,
          job: u.job,
          hp: u.hp,
          maxHp: u.maxHp,
          from: { x: u.x, y: u.y },
          to: { x: u.x, y: u.y },
          deployed: false,
          lost: false,
        };
      const nx = u.x - sx,
        ny = u.y - sy;
      const lost = nx < 0 || ny < 0 || nx >= width || ny >= height;
      return {
        id: u.id,
        name: u.name,
        team: u.team,
        job: u.job,
        hp: u.hp,
        maxHp: u.maxHp,
        from: { x: u.x, y: u.y },
        to: lost ? { x: u.x, y: u.y } : { x: nx, y: ny },
        deployed: true,
        lost,
      };
    });
  return {
    width,
    height,
    anchor,
    sx,
    sy,
    tiles,
    units,
    lostUnits: units.filter((u) => u.lost),
    lostTiles,
    keptTileCount,
    lostTileCount: b.tiles.length - keptTileCount,
    addedTileCount: width * height - keptTileCount,
    changed: width !== b.width || height !== b.height,
  };
}
/** 合法部署格：地形对该角色可通行，且没有存活角色占位。 */
export function deployTiles(b: Battle, u?: Unit) {
  return b.tiles.filter(
    (t) =>
      Number.isFinite(
        u ? movementCost(t.terrain, u) : terrainRules[t.terrain].cost,
      ) && !unitAt(b, t),
  );
}
export function canDeploy(b: Battle, u: Unit, p: Point) {
  const tile = tileAt(b, p);
  return Boolean(
    tile &&
      u.hp > 0 &&
      !u.deployed &&
      Number.isFinite(movementCost(tile.terrain, u)) &&
      !unitAt(b, p),
  );
}
export const pendingUnits = pending;
function applyPlan(b: Battle, plan: ResizePlan) {
  b.tiles = plan.tiles.map((t) => ({ ...t }));
  b.width = plan.width;
  b.height = plan.height;
  for (const u of b.units) {
    if (!u.deployed) continue;
    const nx = u.x - plan.sx,
      ny = u.y - plan.sy;
    if (nx < 0 || ny < 0 || nx >= plan.width || ny >= plan.height) {
      u.deployed = false;
      continue;
    }
    u.x = nx;
    u.y = ny;
  }
}
/**
 * 确认前校验：缩图后若仍有角色被挤出，必须有可通行空地供其落点；
 * 若战场会被完全堵死而无法开始下一回合，也拒绝。基于副本校验，不改战场。
 */
export function resizeObstacle(b: Battle, plan: ResizePlan): string | null {
  if (!plan.changed) return null;
  const probe = clone(b);
  applyPlan(probe, plan);
  if (pending(probe).length && !deployTiles(probe).length)
    return "所有格子均被阻挡，无法放下待部署角色；请取消并调整地形或尺寸";
  return null;
}
/** 把待部署角色放回合法空地；角色保留职业、生命与状态。 */
export function deployUnit(b: Battle, id: string, p: Point) {
  const u = findUnit(b, id);
  if (u.hp <= 0) throw new Error("阵亡角色无法部署");
  if (u.deployed) throw new Error("该角色已在战场上");
  if (!canDeploy(b, u, p)) throw new Error("请选择未被阻挡的空地");
  const wasActive = b.active;
  const queue = [...b.queue];
  const wasMoved = u.moved,
    wasActed = u.acted;
  u.x = p.x;
  u.y = p.y;
  u.deployed = true;
  u.moved = false;
  u.acted = false;
  if (!b.active) {
    try {
      if (!pending(b).length) beginRound(b);
    } catch (e) {
      // 回滚这次落点，让玩家继续调整地形后重试。
      u.deployed = false;
      u.moved = wasMoved;
      u.acted = wasActed;
      b.queue = queue;
      b.active = wasActive;
      throw e;
    }
    return;
  }
  if (!b.queue.includes(id)) {
    let i = 1;
    while (i < b.queue.length) {
      const other = findUnit(b, b.queue[i]);
      if (
        other.speed > u.speed ||
        (other.speed === u.speed && other.id.localeCompare(u.id) < 0)
      )
        i++;
      else break;
    }
    b.queue.splice(i, 0, id);
  }
}
/**
 * 应用缩放。先校验，任何失败都不会留下半成品状态；
 * 成功的缩放会记录在历史上（由调用方拍快照），并修复行动队列。
 */
export function applyResize(b: Battle, plan: ResizePlan) {
  const obstacle = resizeObstacle(b, plan);
  if (obstacle) throw new Error(obstacle);
  applyPlan(b, plan);
  syncTurnState(b);
}
export { DEFAULT_HEIGHT, DEFAULT_WIDTH, MIN_SIZE, MAX_SIZE };
