<script setup lang="ts">
import type { Battle, Point } from "../../../shared/types";
import { key } from "../../../shared/document";
import { terrainRules } from "../lib/cost";
import type { ResizePlan } from "../model/resize";
defineProps<{
  battle: Battle;
  selected: string;
  routes: string[];
  targets: string[];
  path: Point[];
  /** 待部署角色可以落脚的合法空地。 */
  deployable: string[];
  /** 缩放预览：保留当前战场，并标出将被裁掉的地形与角色位置。 */
  plan: ResizePlan | null;
}>();
defineEmits<{ cell: [point: Point] }>();
function isLost(plan: ResizePlan, p: Point) {
  return (
    p.x < plan.sx ||
    p.x >= plan.sx + plan.width ||
    p.y < plan.sy ||
    p.y >= plan.sy + plan.height
  );
}
/** 预览的保留窗口：按百分比覆盖在当前地图上，不影响网格布局。 */
function windowStyle(plan: ResizePlan, b: Battle) {
  const span = {
    left: Math.min(Math.max(plan.sx, 0), b.width),
    top: Math.min(Math.max(plan.sy, 0), b.height),
    right: Math.min(Math.max(plan.sx + plan.width, 0), b.width),
    bottom: Math.min(Math.max(plan.sy + plan.height, 0), b.height),
  };
  return {
    left: `${(span.left / b.width) * 100}%`,
    top: `${(span.top / b.height) * 100}%`,
    width: `${((span.right - span.left) / b.width) * 100}%`,
    height: `${((span.bottom - span.top) / b.height) * 100}%`,
  };
}
</script>
<template>
  <section class="map-frame" :class="{ resizing: !!plan }">
    <div class="map-caption">
      <span>渡口 07 / 北部边境 · 当前 {{ battle.width }} × {{ battle.height }}</span
      ><span :class="{ 'preview-tag': !!plan }">{{
        plan && plan.changed
          ? `预览 ${plan.width} × ${plan.height} · 待确认`
          : `${battle.width} × ${battle.height} · 四向网格`
      }}</span>
    </div>
    <div
      class="battle-map"
      role="grid"
      aria-label="战术地图"
      :style="{ '--cols': battle.width }"
    >
      <div
        v-if="plan && plan.changed"
        class="keep-window"
        :style="windowStyle(plan, battle)"
        aria-hidden="true"
      />
      <button
        v-for="tile in battle.tiles"
        :key="key(tile)"
        :data-cell="key(tile)"
        :class="[
          'tile',
          tile.terrain,
          {
            reachable: !plan && routes.includes(key(tile)),
            target: !plan && targets.includes(key(tile)),
            trail: !plan && path.some((p) => key(p) === key(tile)),
            deployable: !plan && deployable.includes(key(tile)),
            doomed: !!plan && plan.changed && isLost(plan, tile),
          },
        ]"
        :aria-label="`${tile.x + 1},${tile.y + 1} ${
          terrainRules[tile.terrain].name
        }${plan && plan.changed && isLost(plan, tile) ? ' 将被裁切' : ''}`"
        @click="$emit('cell', tile)"
      >
        <span class="ground">{{ terrainRules[tile.terrain].glyph }}</span
        ><template
          v-for="unit in battle.units.filter(
            (u) => u.hp > 0 && u.deployed && key(u) === key(tile),
          )"
          :key="unit.id"
          ><span
            :class="[
              'pawn',
              unit.team,
              {
                selected: !plan && unit.id === selected,
                active: unit.id === battle.active,
                lost:
                  !!plan &&
                  plan.changed &&
                  plan.lostUnits.some((v) => v.id === unit.id),
              },
            ]"
            >{{
              unit.job === "guard"
                ? "♜"
                : unit.job === "ranger"
                  ? "➶"
                  : unit.job === "mage"
                    ? "✦"
                    : "✚"
            }}<i
              :style="{
                width: (unit.hp / unit.maxHp) * 100 + '%',
              }" /></span></template
        ><small>{{ tile.x + 1 }}·{{ tile.y + 1 }}</small>
      </button>
    </div>
    <div class="map-caption">
      <template v-if="plan && plan.changed">
        <span v-if="plan.lostUnits.length" class="warn"
          >⚠ {{ plan.lostUnits.map((u) => u.name).join("、")
          }}将被移入待部署列表（保留职业与生命）</span
        ><span v-else>缩图后编队仍完整，无角色被挤出</span>
        <span
          >保留 {{ plan.keptTileCount }} 格 · 裁去 {{ plan.lostTileCount }} 格
          · 新增 {{ plan.addedTileCount }} 格</span
        >
      </template>
      <template v-else>
        <span>浅滩纵贯南北 · 中央石桥可快速渡河</span
        ><span>◇ 当前行动　● 可移动　◈ 技能目标</span>
      </template>
    </div>
    <div v-if="deployable.length && !plan" class="map-caption deploy-hint">
      <span>◌ 待部署落点</span><span>{{ deployable.length }} 格可放置</span>
    </div>
  </section>
</template>
