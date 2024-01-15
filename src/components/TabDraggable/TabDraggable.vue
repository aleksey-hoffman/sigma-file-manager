<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Container, Draggable} from 'vue3-smooth-dnd';

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

function getItemGhostParent () {
  return document.querySelector(props.parentSelector);
}

function onDrop<T> (dropResult) {
  emit('set', getUpdatedList(dropResult) as T[]);
}

function getUpdatedList (dropResult) {
  const {removedIndex, addedIndex, payload} = dropResult;

  if (removedIndex === null && addedIndex === null) {
    return props.items;
  }

  const result = [...props.items];
  let itemToAdd = payload;

  if (removedIndex !== null) {
    itemToAdd = result.splice(removedIndex, 1)[0];
  }
  if (addedIndex !== null) {
    result.splice(addedIndex, 0, itemToAdd);
  }
  return result;
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
      @drag-start="emit('drag-start')"
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
