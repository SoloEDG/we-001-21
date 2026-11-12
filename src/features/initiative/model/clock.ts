import type { Battle } from "../../../shared/types";
import { onField, pending } from "../../../shared/document";
export function turnProgress(b: Battle) {
  const alive = onField(b).length;
  return alive ? Math.round(((alive - b.queue.length) / alive) * 100) : 100;
}
export function turnLabel(b: Battle) {
  if (b.ended) return `${b.ended === "azure" ? "苍蓝军" : "余烬军"}获胜`;
  if (!b.active && pending(b).length)
    return `第 ${b.round} 回合 · 等待 ${pending(b).length} 人重新部署`;
  if (!b.active) return `第 ${b.round} 回合 · 所有格子均被阻挡`;
  return `第 ${b.round} 回合 · ${b.queue.length} 人待行动`;
}
