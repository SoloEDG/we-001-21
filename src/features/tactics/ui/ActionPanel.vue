<script setup lang="ts">
import type { Unit } from "../../../shared/types";
import { skillBook } from "../model/skills";
defineProps<{
  unit: Unit | null;
  skill: string;
  locked: boolean;
  notice: string;
  /** 正在等待落点的待部署角色名；为空表示没有处于落点模式。 */
  placingName: string | null;
}>();
defineEmits<{ skill: [id: string]; wait: [] }>();
</script>
<template>
  <section class="panel action-panel">
    <div class="eyebrow">03 / TACTICAL ORDERS</div>
    <template v-if="placingName">
      <h3>
        部署 {{ placingName }}
        <small>选择一个空地落点</small>
      </h3>
      <p class="instruction">
        点击地图上的浅色空地放置该角色。职业、生命与状态会完整保留，放回后可继续行动。
      </p>
      <p class="notice" role="status">{{ notice }}</p>
    </template>
    <template v-else-if="!unit">
      <h3>等待部署</h3>
      <p class="instruction">
        有角色被挤出编队。在左侧编队中选择待部署角色，再点击地图上的浅色空地将其放回。
      </p>
      <p class="notice" role="status">{{ notice }}</p>
    </template>
    <template v-else>
      <h3>
        {{ unit.name }}的指令
        <small
          >{{ unit.moved ? "已移动" : "可移动" }} /
          {{ unit.acted ? "已施法" : "可施法" }}</small
        >
      </h3>
      <p class="instruction">
        点击蓝色格移动；选择技能后点击目标。双方均由你指挥。
      </p>
      <div class="skills">
        <button
          v-for="s in skillBook[unit.job]"
          :key="s.id"
          :disabled="locked || unit.acted"
          :class="{ chosen: skill === s.id }"
          @click="$emit('skill', skill === s.id ? '' : s.id)"
        >
          <span
            >{{ s.name }} <small>距离 {{ s.range }}</small></span
          ><small>{{ s.description }}</small>
        </button>
      </div>
      <button
        class="primary end-turn"
        :disabled="locked"
        @click="$emit('wait')"
      >
        结束行动 <span>→</span>
      </button>
      <p class="notice" role="status">{{ notice }}</p>
    </template>
  </section>
</template>
