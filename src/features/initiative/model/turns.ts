import type { Battle } from "../../../shared/types";
import { findUnit, onField, pending, unitAt } from "../../../shared/document";
import { order, outcome } from "../lib/order";
import { terrainRules } from "../../terrain/lib/cost";
/** 所有格子都被阻挡：没有任何可通行且未被占用的格子。 */
export function blockedMap(b: Battle) {
  return b.tiles.every(
    (t) => !Number.isFinite(terrainRules[t.terrain].cost) || !!unitAt(b, t),
  );
}
/**
 * 开始新回合。检查全部在改动之前完成，失败时战场保持原样：
 * 还有角色等待部署、或所有格子都被阻挡时拒绝。
 */
export function beginRound(b: Battle) {
  if (pending(b).length) throw new Error("仍有角色等待部署");
  if (!onField(b).length) throw new Error("没有可行动角色");
  if (blockedMap(b)) throw new Error("所有格子均被阻挡，无法开始新回合");
  b.round++;
  b.queue = order(b);
  for (const u of onField(b)) {
    u.moved = false;
    u.acted = false;
  }
  b.active = b.queue[0] ?? "";
}
/**
 * 修复行动队列与当前角色：
 * - 被挤出战场的角色不再参与行动；
 * - 队列清空且仍有待部署角色时停在待部署阶段；
 * - 其余情况尝试开始新回合，失败则停在待部署阶段以便恢复。
 */
export function syncTurnState(b: Battle) {
  const field = new Set(onField(b).map((u) => u.id));
  b.queue = b.queue.filter((id) => field.has(id));
  if (b.active && !field.has(b.active)) b.active = b.queue[0] ?? "";
  if (b.active || b.queue.length || pending(b).length) return;
  try {
    beginRound(b);
  } catch {
    b.active = "";
  }
}
function runTurn(
  b: Battle,
  tick: (u: ReturnType<typeof findUnit>) => void,
) {
  tick(findUnit(b, b.active));
  b.queue = b.queue.filter((id) => {
    const u = findUnit(b, id);
    return id !== b.active && u.hp > 0 && u.deployed;
  });
  b.ended = outcome(b);
  if (b.ended) return;
  if (!b.queue.length) {
    // 待部署角色尚未归队时推进回合会吞掉它们的行动机会，先停在部署阶段。
    if (pending(b).length) {
      b.active = "";
      return;
    }
    beginRound(b);
    return;
  }
  b.active = b.queue[0];
}
/**
 * 结束当前角色的行动。结算在副本上完成；任何校验失败
 * （例如所有格子都被阻挡而无法开始新回合）都不会破坏战场，
 * 玩家仍可继续编辑地形后重试。
 */
export function finishTurn(
  b: Battle,
  tick: (u: ReturnType<typeof findUnit>) => void,
) {
  const probe = JSON.parse(JSON.stringify(b)) as Battle;
  runTurn(probe, tick);
  Object.assign(b, probe);
}
