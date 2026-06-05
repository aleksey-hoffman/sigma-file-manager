<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useFileBrowserListColumns } from './composables/use-file-browser-list-columns';
import type { FileBrowserListColumnId } from './utils/file-browser-list-columns';

const props = withDefaults(defineProps<{
  columnId: FileBrowserListColumnId;
  showResizeHandle?: boolean;
}>(), {
  showResizeHandle: true,
});

const {
  activeResizeColumnId,
  beginColumnResize,
  updateColumnResize,
  finishColumnResize,
  cancelColumnResize,
} = useFileBrowserListColumns();

function handleResizePointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const cellElement = (event.currentTarget as HTMLElement).closest('.file-browser-list-view__header-cell');

  if (!cellElement) {
    return;
  }

  const handleElement = event.currentTarget as HTMLElement;
  const definitionStartWidth = cellElement.getBoundingClientRect().width;
  const pointerStartX = event.clientX;
  const pointerId = event.pointerId;

  beginColumnResize(props.columnId, definitionStartWidth);

  function handlePointerMove(moveEvent: PointerEvent) {
    if (moveEvent.pointerId !== pointerId) {
      return;
    }

    const delta = moveEvent.clientX - pointerStartX;
    updateColumnResize(props.columnId, definitionStartWidth + delta);
  }

  async function handlePointerEnd(endEvent: PointerEvent) {
    if (endEvent.pointerId !== pointerId) {
      return;
    }

    handleElement.releasePointerCapture(pointerId);
    handleElement.removeEventListener('pointermove', handlePointerMove);
    handleElement.removeEventListener('pointerup', handlePointerEnd);
    handleElement.removeEventListener('pointercancel', handlePointerEnd);

    if (endEvent.type === 'pointercancel') {
      cancelColumnResize();
      return;
    }

    await finishColumnResize(props.columnId);
  }

  handleElement.setPointerCapture(pointerId);
  handleElement.addEventListener('pointermove', handlePointerMove);
  handleElement.addEventListener('pointerup', handlePointerEnd);
  handleElement.addEventListener('pointercancel', handlePointerEnd);
}
</script>

<template>
  <div class="file-browser-list-view__header-cell">
    <slot />
    <div
      v-if="props.showResizeHandle"
      class="file-browser-list-view__header-resize-handle"
      :class="{
        'file-browser-list-view__header-resize-handle--active': activeResizeColumnId === props.columnId,
      }"
      @pointerdown="handleResizePointerDown"
    />
  </div>
</template>

<style scoped>
.file-browser-list-view__header-cell {
  position: relative;
  display: flex;
  overflow: visible;
  min-width: min-content;
  align-items: center;
}

.file-browser-list-view__header-resize-handle {
  position: absolute;
  z-index: 2;
  top: -2px;
  right: calc((var(--file-browser-list-column-gap) / -2) - 3px);
  bottom: -2px;
  width: 7px;
  border-radius: 2px;
  cursor: col-resize;
  opacity: 0;
  touch-action: none;
  transition: opacity 0.15s ease;
}

.file-browser-list-view__header-resize-handle--active {
  opacity: 1;
}

.file-browser-list-view__header-resize-handle::after {
  position: absolute;
  top: 18%;
  bottom: 18%;
  left: 50%;
  width: 2px;
  border-radius: 1px;
  background-color: hsl(var(--border));
  content: '';
  transform: translateX(-50%);
  transition: background-color 0.15s ease;
}

.file-browser-list-view__header-resize-handle:hover::after,
.file-browser-list-view__header-resize-handle--active::after {
  background-color: hsl(var(--primary));
}
</style>
