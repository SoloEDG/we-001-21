import type { Battle, Point, Unit } from "./types";
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const key = (p: Point) => `${p.x},${p.y}`;
export const distance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
/** 存活角色（含尚未部署的待部署角色）。 */
export const living = (b: Battle) => b.units.filter((u) => u.hp > 0);
/** 存活且已经在战场上的角色。 */
export const onField = (b: Battle) =>
  b.units.filter((u) => u.hp > 0 && u.deployed);
export const pending = (b: Battle) =>
  b.units.filter((u) => u.hp > 0 && !u.deployed);
export const inBounds = (b: Battle, p: Point) =>
  p.x >= 0 && p.y >= 0 && p.x < b.width && p.y < b.height;
export const tileAt = (b: Battle, p: Point) =>
  b.tiles.find((t) => t.x === p.x && t.y === p.y);
export const unitAt = (b: Battle, p: Point) =>
  b.units.find(
    (u) => u.hp > 0 && u.deployed && u.x === p.x && u.y === p.y,
  );
export const findUnit = (b: Battle, id: string): Unit => {
  const u = b.units.find((u) => u.id === id);
  if (!u) throw new Error("角色不存在");
  return u;
};
/** 结构校验：尺寸、格子、角色占位与行动队列。 */
export function assertBattle(b: Battle) {
  if (!Number.isInteger(b.width) || !Number.isInteger(b.height))
    throw new Error("地图尺寸缺失");
  if (b.width < 1 || b.height < 1) throw new Error("地图尺寸不合法");
  if (
    b.tiles.length !== b.width * b.height ||
    new Set(b.tiles.map(key)).size !== b.tiles.length
  )
    throw new Error("地图数据不完整");
  for (const t of b.tiles)
    if (t.x < 0 || t.y < 0 || t.x >= b.width || t.y >= b.height)
      throw new Error("地图数据越界");
  if (
    !b.units.length ||
    new Set(b.units.map((u) => u.id)).size !== b.units.length
  )
    throw new Error("角色数据不完整");
  const field = b.units.filter((u) => u.hp > 0 && u.deployed);
  if (new Set(field.map(key)).size !== field.length)
    throw new Error("角色数据重叠");
  for (const u of b.units)
    if (u.deployed && !inBounds(b, u)) throw new Error("角色数据越界");
  if (b.active && !b.queue.includes(b.active) && !b.ended)
    throw new Error("行动队列与当前角色不一致");
}
