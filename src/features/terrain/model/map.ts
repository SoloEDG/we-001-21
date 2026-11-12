import type { Battle, Point, Terrain, Tile } from "../../../shared/types";
import { key } from "../../../shared/document";
export const DEFAULT_WIDTH = 12;
export const DEFAULT_HEIGHT = 8;
export const MIN_SIZE = 2;
export const MAX_SIZE = 24;
export function tileTerrain(x: number, y: number): Terrain {
  return x === 6 && y !== 3 && y !== 4
    ? "water"
    : (x === 4 && y < 3) || (x === 8 && y > 3)
      ? "forest"
      : x === 9 && y < 3
        ? "ridge"
        : x === 5 && y === 6
          ? "wall"
          : "plain";
}
export function createMap(
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      tiles.push({ x, y, terrain: tileTerrain(x, y) });
  return tiles;
}
export function paintTile(b: Battle, p: Point, terrain: Terrain) {
  if (b.units.some((u) => u.hp > 0 && u.deployed && key(u) === key(p)))
    throw new Error("角色脚下不可编辑地形");
  const tile = b.tiles.find((t) => key(t) === key(p));
  if (!tile) throw new Error("地图外坐标");
  tile.terrain = terrain;
}
