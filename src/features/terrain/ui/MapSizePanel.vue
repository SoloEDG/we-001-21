<script setup lang="ts">
import type { ResizeDraft, ResizePlan } from "../model/resize";
import { MAX_SIZE, MIN_SIZE, anchorNames, anchorNotes, anchors } from "../model/resize";
const props = defineProps<{
  draft: ResizeDraft;
  plan: ResizePlan | null;
  locked: boolean;
}>();
const emit = defineEmits<{
  update: [patch: Partial<ResizeDraft>];
  confirm: [];
  cancel: [];
}>();
function step(axis: "width" | "height", delta: number) {
  emit("update", { [axis]: Number(props.draft[axis]) + delta });
}
function onInput(axis: "width" | "height", event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  emit("update", { [axis]: value });
}
</script>
<template>
  <section class="panel size-panel">
    <div class="eyebrow">05 / MAP EXTENT</div>
    <h3>
      地图尺寸
      <small v-if="plan"
        >预览 {{ plan.width }} × {{ plan.height }}</small
      >
    </h3>
    <p class="instruction">
      调整宽高并选择锚点。缩小时超出的地形与角色会先预览，确认后才改写战场。
    </p>
    <div class="size-grid">
      <label>
        <span>宽度 / 列</span>
        <div class="size-stepper">
          <button type="button" :disabled="locked" @click="step('width', -1)">
            −
          </button>
          <input
            type="number"
            :min="MIN_SIZE"
            :max="MAX_SIZE"
            :value="draft.width"
            :disabled="locked"
            @input="onInput('width', $event)"
          />
          <button type="button" :disabled="locked" @click="step('width', 1)">
            +
          </button>
        </div>
        <small>{{ MIN_SIZE }}–{{ MAX_SIZE }}</small>
      </label>
      <label>
        <span>高度 / 行</span>
        <div class="size-stepper">
          <button type="button" :disabled="locked" @click="step('height', -1)">
            −
          </button>
          <input
            type="number"
            :min="MIN_SIZE"
            :max="MAX_SIZE"
            :value="draft.height"
            :disabled="locked"
            @input="onInput('height', $event)"
          />
          <button type="button" :disabled="locked" @click="step('height', 1)">
            +
          </button>
        </div>
        <small>{{ MIN_SIZE }}–{{ MAX_SIZE }}</small>
      </label>
    </div>
    <div class="anchor-list">
      <button
        v-for="a in anchors"
        :key="a"
        type="button"
        :disabled="locked"
        :class="{ chosen: draft.anchor === a }"
        @click="emit('update', { anchor: a })"
      >
        <span>{{ anchorNames[a] }}</span><small>{{ anchorNotes[a] }}</small>
      </button>
    </div>
    <p v-if="plan && plan.changed" class="size-summary">
      保留 {{ plan.keptTileCount }} 格 · 裁去 {{ plan.lostTileCount }} 格 · 新增
      {{ plan.addedTileCount }} 格
      <b v-if="plan.lostUnits.length"
        >{{ plan.lostUnits.length }} 名角色将进入待部署列表</b
      >
    </p>
    <p v-else-if="plan" class="size-summary">尺寸与当前一致，确认后不会改变战场。</p>
    <div class="size-actions">
      <button type="button" :disabled="locked" @click="emit('cancel')">
        取消
      </button>
      <button
        type="button"
        class="primary"
        :disabled="locked"
        @click="emit('confirm')"
      >
        确认尺寸
      </button>
    </div>
    <p
      v-if="plan && plan.changed && plan.lostUnits.length && !plan.addedTileCount"
      class="warn"
    >
      裁切后没有新增格子，请确认待部署角色仍有落脚点。
    </p>
    <p
      v-if="plan && plan.changed && plan.lostTileCount > 0"
      class="size-note"
    >
      缩图不会删除任何角色；被挤出的角色进入待部署列表，确认后需放回合法空地才能继续行动。
    </p>
  </section>
</template>
