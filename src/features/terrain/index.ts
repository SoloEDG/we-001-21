export { default as BattleMap } from "./ui/BattleMap.vue";
export { default as TerrainPanel } from "./ui/TerrainPanel.vue";
export { default as MapSizePanel } from "./ui/MapSizePanel.vue";
export { createMap, paintTile } from "./model/map";
export { reachable } from "./lib/paths";
export { terrainRules } from "./lib/cost";
export {
  anchors,
  anchorNames,
  anchorNotes,
  clampSize,
  planResize,
  applyResize,
  resizeObstacle,
  deployUnit,
  deployTiles,
  canDeploy,
  pendingUnits,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  MIN_SIZE,
  MAX_SIZE,
} from "./model/resize";
export type { ResizeAnchor, ResizeDraft, ResizePlan } from "./model/resize";
