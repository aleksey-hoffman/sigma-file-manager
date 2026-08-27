<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts" generic="T">
import {
  onUnmounted,
  ref,
  shallowRef,
  useAttrs,
  watch,
} from 'vue';
import { applyDropResult, haveSameKeyOrder } from '@/utils/reorder-matching-items';
import { getNeighborReorderIndex, getRowMidpointsFromHeights } from './sortable-geometry';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  items: T[];
  getKey: (item: T) => string;
  handleSelector?: string;
}>();

const emit = defineEmits<{
  'set': [value: T[]];
  'drag-start': [];
  'drag-end': [];
}>();

defineSlots<{
  item(props: { item: T }): unknown;
}>();

const attrs = useAttrs();
const DRAG_START_DISTANCE_PX = 4;

const listRef = ref<HTMLElement | null>(null);
const localItems = shallowRef<T[]>([...props.items]);
const draggingIndex = ref<number | null>(null);
const isDragging = ref(false);
const ghostX = ref(0);
const ghostY = ref(0);
const ghostWidth = ref(0);

let pointerStartY = 0;
let grabOffsetX = 0;
let grabOffsetY = 0;
let lastClientX = 0;
let lastClientY = 0;
let activePointerId: number | null = null;
let rowHeights: number[] = [];

watch(
  () => props.items,
  (items) => {
    if (draggingIndex.value !== null) {
      return;
    }

    localItems.value = [...items];
  },
);

function captureRowHeights() {
  const listElement = listRef.value;

  if (!listElement) {
    rowHeights = [];
    return;
  }

  rowHeights = Array.from(
    listElement.querySelectorAll<HTMLElement>(':scope > .sortable-list__items > .sortable-list__item'),
    row => row.getBoundingClientRect().height,
  );
}

function getRowMidpoints(): number[] {
  const listElement = listRef.value;

  if (!listElement) {
    return [];
  }

  return getRowMidpointsFromHeights(listElement.getBoundingClientRect().top, rowHeights);
}

function setDocumentDragging(enabled: boolean) {
  document.documentElement.classList.toggle('sortable-list-dragging', enabled);
}

function moveGhost(clientX: number, clientY: number) {
  ghostX.value = clientX - grabOffsetX;
  ghostY.value = clientY - grabOffsetY;
}

function stopPointerTracking() {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
}

function isHandleTarget(eventTarget: EventTarget | null): boolean {
  if (!props.handleSelector) {
    return true;
  }

  return eventTarget instanceof Element && eventTarget.closest(props.handleSelector) !== null;
}

function onPointerDown(pointerEvent: PointerEvent, index: number) {
  if (pointerEvent.button !== 0 || !isHandleTarget(pointerEvent.target)) {
    return;
  }

  const row = pointerEvent.currentTarget;

  if (!(row instanceof HTMLElement)) {
    return;
  }

  pointerEvent.stopPropagation();

  const handle = props.handleSelector
    ? pointerEvent.target instanceof Element
      ? pointerEvent.target.closest<HTMLElement>(props.handleSelector)
      : null
    : row;
  const grabElement = handle ?? row;
  const rect = grabElement.getBoundingClientRect();
  grabOffsetX = pointerEvent.clientX - rect.left;
  grabOffsetY = pointerEvent.clientY - rect.top;
  ghostWidth.value = row.getBoundingClientRect().width;
  pointerStartY = pointerEvent.clientY;
  lastClientX = pointerEvent.clientX;
  lastClientY = pointerEvent.clientY;
  draggingIndex.value = index;
  isDragging.value = false;
  activePointerId = pointerEvent.pointerId;
  moveGhost(pointerEvent.clientX, pointerEvent.clientY);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function startDragging() {
  isDragging.value = true;
  captureRowHeights();
  setDocumentDragging(true);
  emit('drag-start');
  moveGhost(lastClientX, lastClientY);
}

function onPointerMove(pointerEvent: PointerEvent) {
  if (draggingIndex.value === null || activePointerId !== pointerEvent.pointerId) {
    return;
  }

  lastClientX = pointerEvent.clientX;
  lastClientY = pointerEvent.clientY;

  if (!isDragging.value) {
    if (Math.abs(pointerEvent.clientY - pointerStartY) < DRAG_START_DISTANCE_PX) {
      return;
    }

    startDragging();
  }

  pointerEvent.preventDefault();
  moveGhost(pointerEvent.clientX, pointerEvent.clientY);

  const nextIndex = getNeighborReorderIndex(
    pointerEvent.clientY,
    draggingIndex.value,
    getRowMidpoints(),
  );

  if (nextIndex === draggingIndex.value) {
    return;
  }

  const dropResult = {
    removedIndex: draggingIndex.value,
    addedIndex: nextIndex,
    payload: localItems.value[draggingIndex.value],
  };

  localItems.value = applyDropResult(localItems.value, dropResult);
  rowHeights = applyDropResult(rowHeights, {
    ...dropResult,
    payload: rowHeights[draggingIndex.value],
  });
  draggingIndex.value = nextIndex;
}

function onPointerUp(pointerEvent: PointerEvent) {
  if (activePointerId !== pointerEvent.pointerId) {
    return;
  }

  stopPointerTracking();
  setDocumentDragging(false);

  const hadDrag = isDragging.value;
  const nextItems = localItems.value;

  draggingIndex.value = null;
  isDragging.value = false;
  activePointerId = null;
  rowHeights = [];

  if (!hadDrag) {
    return;
  }

  if (!haveSameKeyOrder(props.items, nextItems, props.getKey)) {
    emit('set', nextItems);
  }

  emit('drag-end');
}

onUnmounted(() => {
  stopPointerTracking();
  setDocumentDragging(false);
});
</script>

<template>
  <div
    ref="listRef"
    class="sortable-list"
    :class="[attrs.class, { 'sortable-list--dragging': isDragging }]"
  >
    <TransitionGroup
      class="sortable-list__items"
      name="sortable-list"
      tag="div"
    >
      <div
        v-for="(item, index) in localItems"
        :key="props.getKey(item)"
        class="sortable-list__item"
        :class="{ 'sortable-list__item--placeholder': index === draggingIndex && isDragging }"
        @pointerdown="onPointerDown($event, index)"
      >
        <slot
          name="item"
          :item="item"
        />
      </div>
    </TransitionGroup>
  </div>

  <Teleport to="body">
    <div
      v-if="isDragging && draggingIndex !== null"
      class="sortable-list__ghost"
      :style="{
        top: `${ghostY}px`,
        left: `${ghostX}px`,
        width: `${ghostWidth}px`,
      }"
    >
      <slot
        name="item"
        :item="localItems[draggingIndex]"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.sortable-list {
  width: 100%;
}

.sortable-list--dragging {
  user-select: none;
}

.sortable-list__item {
  width: 100%;
  touch-action: none;
}

.sortable-list__item--placeholder {
  opacity: 0;
}

.sortable-list--dragging .sortable-list-move {
  transition: transform 250ms ease;
}
</style>

<style>
.sortable-list__ghost {
  position: fixed;
  z-index: 200;
  top: 0;
  left: 0;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--popover));
  box-shadow: 0 4px 12px hsl(var(--background) / 80%);
  pointer-events: none;
}

html.sortable-list-dragging,
html.sortable-list-dragging * {
  cursor: grabbing !important;
  user-select: none !important;
}
</style>
