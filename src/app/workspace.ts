import { computed, reactive, ref } from "vue";
import type { Point, Terrain, Unit } from "../shared/types";
import { clone, findUnit, key } from "../shared/document";
import {
  reachable,
  terrainRules,
  paintTile,
  planResize,
  applyResize,
  canDeploy,
  deployUnit,
  deployTiles,
  pendingUnits,
  anchorNames,
  type ResizeAnchor,
  type ResizeDraft,
} from "../features/terrain";
import { moveBudget, armorValue, tickStatuses } from "../features/roster";
import {
  getSkill,
  legalTargets,
  moveUnit,
  castSkill,
} from "../features/tactics";
import { finishTurn, syncTurnState } from "../features/initiative";
import {
  record,
  frame,
  loadArchive,
  saveArchive,
  usePlayback,
} from "../features/replay";
import { newSession } from "./session";
export function useWorkspace() {
  const session = reactive(loadArchive() ?? newSession());
  const cursor = ref(-1),
    selected = ref(session.live.active),
    skill = ref(""),
    brush = ref<Terrain | null>(null),
    /** 正在等待落点的待部署角色。 */
    placement = ref<string | null>(
      pendingUnits(session.live)[0]?.id ?? null,
    ),
    resizeOpen = ref(false),
    resizeDraft = ref<ResizeDraft>({
      width: session.live.width,
      height: session.live.height,
      anchor: "center",
    }),
    notice = ref("选择蓝色格移动，或选择技能指定目标。");
  const playback = usePlayback(
    () => session.events.length,
    (n) => {
      cursor.value = n;
    },
  );
  const battle = computed(() => frame(session, cursor.value));
  const actor = computed<Unit | null>(() =>
    battle.value.active ? findUnit(battle.value, battle.value.active) : null,
  );
  const locked = computed(() => cursor.value >= 0 || !!session.live.ended);
  /** 只要还有角色等待落点，战场就处于部署阶段。 */
  const pending = computed(() => pendingUnits(session.live));
  /**
   * 落点模式：选中了待部署角色，或当前回合已结束等待部署。
   * 行动阶段即使有角色等待落点，其他在场角色仍可正常行动。
   */
  const placing = computed(
    () =>
      !locked.value &&
      !!placement.value &&
      pending.value.some((u) => u.id === placement.value),
  );
  const routes = computed(() =>
    !actor.value ||
    locked.value ||
    placing.value ||
    actor.value.moved ||
    actor.value.acted
      ? new Map()
      : reachable(session.live, actor.value, moveBudget(actor.value)),
  );
  const targets = computed(() => {
    if (placing.value) return [];
    const s = actor.value && getSkill(actor.value.job, skill.value);
    return s && actor.value ? legalTargets(battle.value, actor.value, s) : [];
  });
  const resizePlan = computed(() =>
    resizeOpen.value ? planResize(session.live, resizeDraft.value) : null,
  );
  const deployable = computed(() => {
    if (locked.value || pending.value.length === 0) return [];
    const u = session.live.units.find(
      (v) => v.id === (placement.value ?? pending.value[0].id),
    );
    return u ? deployTiles(session.live, u).map(key) : [];
  });
  const placingName = computed(() =>
    placing.value
      ? session.live.units.find((u) => u.id === placement.value)?.name ?? null
      : null,
  );
  function selectUnit(id: string) {
    selected.value = id;
    const u = session.live.units.find((v) => v.id === id);
    if (u && u.hp > 0 && !u.deployed) {
      placement.value = id;
      skill.value = "";
      brush.value = null;
      notice.value = `选择空地放置${u.name}`;
      return;
    }
    // 选择在场角色会退出落点模式，可正常指挥其他角色。
    placement.value = null;
    brush.value = null;
  }
  function cell(p: Point) {
    try {
      if (resizeOpen.value) throw new Error("请先确认或取消尺寸预览");
      if (locked.value) throw new Error("回放只读，请返回实战");
      // 地形编辑优先，部署阶段也能先打通被堵死的格子。
      if (brush.value) {
        const before = clone(session.live);
        paintTile(session.live, p, brush.value);
        // 上次因所有格子被阻挡而无法开始回合时，打通后自动恢复行动。
        const blocked = !session.live.active && !pending.value.length;
        if (blocked) syncTurnState(session.live);
        record(
          session,
          before,
          "terrain",
          `地形调整为${terrainRules[brush.value].name}`,
        );
        saveArchive(session);
        notice.value =
          blocked && session.live.active
            ? "地形已调整，新回合可以开始"
            : session.events.at(-1)!.label;
        return;
      }
      if (placing.value) {
        const id = placement.value!;
        const u = findUnit(session.live, id);
        if (!canDeploy(session.live, u, p))
          throw new Error("请选择未被阻挡的空地");
        const before = clone(session.live);
        try {
          deployUnit(session.live, u.id, p);
        } catch (e) {
          // 所有格子被阻挡时落点回滚，编辑状态仍可恢复。
          notice.value = (e as Error).message;
          return;
        }
        record(session, before, "deploy", `${u.name}重新部署`);
        selected.value = session.live.active || u.id;
        saveArchive(session);
        const next = pendingUnits(session.live)[0];
        placement.value = next?.id ?? null;
        notice.value = next
          ? `${u.name}已重新部署，还有 ${next.name} 等待放置`
          : session.live.active
            ? `${u.name}已重新部署，可继续行动`
            : `${u.name}已重新部署`;
        return;
      }
      const u = actor.value;
      if (!u) throw new Error("请先把待部署角色放回战场");
      const before = clone(session.live);
      if (skill.value) {
        const s = getSkill(u.job, skill.value)!;
        const t = session.live.units.find(
          (t) => t.hp > 0 && t.deployed && key(t) === key(p),
        );
        if (!t) throw new Error("请点击合法角色");
        const ground = session.live.tiles.find((v) => key(v) === key(t))!;
        const high =
          session.live.tiles.find((v) => key(v) === key(u))!.terrain === "ridge";
        const value = castSkill(
          session.live,
          u.id,
          t.id,
          s,
          armorValue(t),
          terrainRules[ground.terrain].cover,
          high,
        );
        record(
          session,
          before,
          "skill",
          `${u.name} → ${t.name} · ${s.name} ${value}`,
        );
        skill.value = "";
      } else {
        const route = routes.value.get(key(p));
        if (!route?.path.length)
          throw new Error("此格不可达，请检查地形与占位");
        moveUnit(session.live, u.id, route.path);
        record(
          session,
          before,
          "move",
          `${u.name}移动 · 消耗${route.cost}`,
          route.path,
        );
      }
      saveArchive(session);
      notice.value = session.events.at(-1)!.label;
    } catch (e) {
      notice.value = (e as Error).message;
    }
  }
  function wait() {
    if (locked.value) return;
    if (!session.live.active) {
      notice.value = pending.value.length
        ? "请先把待部署角色放回战场"
        : "所有格子均被阻挡，请先调整地形";
      return;
    }
    // 有待部署角色时也可以结束在场角色的行动，但队列耗尽后会停在部署阶段。
    const before = clone(session.live);
    try {
      finishTurn(session.live, tickStatuses);
    } catch (e) {
      // 校验失败时 finishTurn 不会改动战场，地形编辑仍可继续。
      notice.value = (e as Error).message;
      return;
    }
    record(
      session,
      before,
      "wait",
      `${findUnit(before, before.active).name}结束行动`,
    );
    selected.value = session.live.active || selected.value;
    skill.value = "";
    placement.value = pendingUnits(session.live)[0]?.id ?? null;
    saveArchive(session);
  }
  function openResize() {
    if (locked.value) {
      notice.value = "回放只读，请返回实战";
      return;
    }
    resizeDraft.value = {
      width: session.live.width,
      height: session.live.height,
      anchor: "center",
    };
    resizeOpen.value = true;
    skill.value = "";
    brush.value = null;
    notice.value = "拖动宽高与锚点查看预览，确认前战场不会变化。";
  }
  function updateResize(patch: Partial<ResizeDraft>) {
    resizeDraft.value = { ...resizeDraft.value, ...patch };
  }
  function cancelResize() {
    resizeOpen.value = false;
    resizeDraft.value = {
      width: session.live.width,
      height: session.live.height,
      anchor: "center" as ResizeAnchor,
    };
    notice.value = "已取消尺寸调整，战场保持原样";
  }
  function confirmResize() {
    if (locked.value) {
      notice.value = "回放只读，请返回实战";
      return;
    }
    const plan = resizePlan.value;
    if (!plan) return;
    if (!plan.changed) {
      resizeOpen.value = false;
      notice.value = "尺寸未变化";
      return;
    }
    const before = clone(session.live);
    try {
      applyResize(session.live, plan);
    } catch (e) {
      // 应用失败时战场不变，保留编辑面板以便继续调整后重试。
      notice.value = (e as Error).message;
      return;
    }
    record(
      session,
      before,
      "resize",
      `地图调整为 ${plan.width} × ${plan.height} · ${anchorNames[plan.anchor]}锚点`,
    );
    const squeezed = pendingUnits(session.live);
    resizeOpen.value = false;
    skill.value = "";
    brush.value = null;
    placement.value = squeezed[0]?.id ?? null;
    selected.value = session.live.active || squeezed[0]?.id || selected.value;
    saveArchive(session);
    notice.value = squeezed.length
      ? `地图已调整为 ${plan.width} × ${plan.height}，${squeezed
          .map((u) => u.name)
          .join("、")} 已进入待部署列表`
      : `地图已调整为 ${plan.width} × ${plan.height}`;
  }
  function seek(n: number) {
    playback.stop();
    cursor.value = n;
    skill.value = "";
    brush.value = null;
    resizeOpen.value = false;
    placement.value = null;
  }
  function reset() {
    playback.stop();
    Object.assign(session, newSession());
    cursor.value = -1;
    selected.value = session.live.active;
    skill.value = "";
    brush.value = null;
    resizeOpen.value = false;
    placement.value = null;
    saveArchive(session);
    notice.value = "新战斗已就绪";
  }
  const path = computed(() =>
    cursor.value > 0 ? (session.events[cursor.value - 1]?.path ?? []) : [],
  );
  return {
    session,
    cursor,
    selected,
    skill,
    brush,
    notice,
    battle,
    actor,
    locked,
    pending,
    placing,
    placingName,
    placement,
    deployable,
    selectUnit,
    routes,
    targets,
    path,
    playback,
    cell,
    wait,
    seek,
    reset,
    resizeOpen,
    resizeDraft,
    resizePlan,
    openResize,
    updateResize,
    confirmResize,
    cancelResize,
  };
}
