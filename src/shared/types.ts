export type Terrain = "plain" | "forest" | "water" | "ridge" | "wall";
export type Profession = "guard" | "ranger" | "mage" | "medic";
export interface Point {
  x: number;
  y: number;
}
export interface Tile extends Point {
  terrain: Terrain;
}
export interface Status {
  kind: "slow" | "burn" | "guard";
  turns: number;
}
export interface Unit extends Point {
  id: string;
  name: string;
  job: Profession;
  team: "azure" | "ember";
  hp: number;
  maxHp: number;
  power: number;
  armor: number;
  speed: number;
  move: number;
  statuses: Status[];
  moved: boolean;
  acted: boolean;
  /**
   * 是否已经放在战场上。被缩图挤出编队的角色会保留全部属性，
   * 但 deployed 变为 false，进入待部署列表。
   */
  deployed: boolean;
}
export interface Battle {
  /** 地图宽度（列数）。历史快照各自保留记录时的尺寸。 */
  width: number;
  /** 地图高度（行数）。 */
  height: number;
  tiles: Tile[];
  units: Unit[];
  round: number;
  queue: string[];
  active: string;
  ended: string | null;
}
export type EventKind =
  | "move"
  | "skill"
  | "wait"
  | "terrain"
  | "resize"
  | "deploy";
export interface BattleEvent {
  id: number;
  kind: EventKind;
  actor: string;
  label: string;
  path: Point[];
  before: Battle;
  after: Battle;
}
export interface Session {
  initial: Battle;
  live: Battle;
  events: BattleEvent[];
}
export interface Skill {
  id: string;
  name: string;
  range: number;
  power: number;
  target: "enemy" | "ally" | "self";
  status?: Status["kind"];
  description: string;
}
