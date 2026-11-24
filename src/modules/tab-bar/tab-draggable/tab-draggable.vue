<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { Container, Draggable, type DropResult } from 'vue3-smooth-dnd';
import { applyDropResult } from '@/utils/reorder-matching-items';
import { removeSmoothDndCursorStyleOnRelease } from '@/utils/smooth-dnd-cursor';

interface Props<T> {
  items: T[];
  parentSelector: string;
}

interface Emits<T> {
  (event: 'set', value: T[]): void;
  (event: 'drag-start'): void;
  (event: 'drag-end'): void;
}

const props = withDefaults(defineProps<Props<unknown>>(), {
});

const emit = defineEmits<Emits<unknown>>();

function getItemGhostParent() {
  return document.querySelector(props.parentSelector);
}

function onDrop(dropResult: DropResult) {
  emit('set', applyDropResult(props.items, dropResult));
}

function onDragStart() {
  removeSmoothDndCursorStyleOnRelease();
  emit('drag-start');
}
</script>

<template>
  <div class="tab-draggable">
    <Container
      v-if="props.items.length > 0"
      class="draggable-list--horizontal"
      drag-class="draggable-list__item--drag-active"
      :animation-duration="250"
      :get-ghost-parent="getItemGhostParent"
      drag-handle-selector=".item-drag-handle"
      lock-axis="x"
      orientation="horizontal"
      @drop="onDrop"
      @drag-start="onDragStart"
      @drag-end="emit('drag-end')"
    >
      <Draggable
        v-for="(item, index) in props.items"
        :key="'draggable-item-' + index"
        class="draggable-list__item"
        border
      >
        <div
          class="item-drag-handle"
          drag
        >
          <slot
            name="item"
            :item="item"
          />
        </div>
      </Draggable>
    </Container>
  </div>
</template>

<style scoped>
.tab-draggable {
  height: var(--tab-height);
  padding: var(--tab-rail-padding);
  border: 1px solid hsl(var(--foreground) / 10%);
  border-radius: var(--radius-lg);
}

.item-drag-handle {
  position: relative;
  height: var(--tab-segment-height);
}
</style>

<style>
.draggable-list__item--drag-active {
  z-index: 100;
  backdrop-filter: blur(24px);
  background-color: hsl(var(--background-2) / 50%);
  cursor: grabbing;
  opacity: 1 !important;
}

.draggable-list__item--drag-active .tab {
  border: 1px solid hsl(var(--primary) / 50%);
  background-color: hsl(var(--background-2) / 50%);
  box-shadow: 0 4px 12px hsl(var(--background) / 80%);
  cursor: grabbing;
}

.draggable-list__item .tab:active {
  border: 1px solid hsl(var(--primary) / 50%);
  background-color: hsl(var(--background-2) / 50%);
  transition: border 0.5s ease;
}

.draggable-list__item + .draggable-list__item .item-drag-handle::before {
  position: absolute;
  top: 25%;
  bottom: 25%;
  left: 0;
  width: 1px;
  background-color: hsl(var(--foreground) / 12%);
  content: "";
}

.draggable-list__item:is(:hover, :has(.tab[is-active="true"])) + .draggable-list__item .item-drag-handle::before,
.draggable-list__item + .draggable-list__item:is(:hover, :has(.tab[is-active="true"])) .item-drag-handle::before {
  display: none;
}
</style>
