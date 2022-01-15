<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <Container
    class="drag-sortable-list--horizontal"
    drag-class="drag-sortable-list--horizontal__item--drag-active"
    v-if="items.length !== 0"
    @drop="onItemDrop"
    :animation-duration="250"
    :get-ghost-parent="getItemGhostParent"
    drag-handle-selector=".item-drag-handle"
    lock-axis="x"
    orientation="horizontal"
  >
    <Draggable
      v-for="(item, index) in items"
      :key="'drag-sortable-item-' + index"
      class="drag-sortable-list--horizontal__item"
      border
    >
      <div class="item-drag-handle" drag>
        <slot name="item" :item="item"></slot>
      </div>
    </Draggable>
  </Container>
</template>

<script>
import {Container, Draggable} from 'vue-smooth-dnd'

export default {
  components: {
    Container,
    Draggable,
  },
  props: {
    items: Array,
    updateItems: Function,
  },
  methods: {
    getItemGhostParent () {
      return document.querySelector('#app')
    },
    onItemDrop (dropResult) {
      this.moveItem(dropResult)
    },
    moveItem (dropResult) {
      const {removedIndex, addedIndex} = dropResult
      if (removedIndex !== null && addedIndex !== null) {
        const list = [...this.items]
        const itemToAdd = list.splice(removedIndex, 1)[0]
        list.splice(addedIndex, 0, itemToAdd)
        this.updateItems(list)
      }
    },
  },
}
</script>

<style>
.smooth-dnd-container.horizontal.drag-sortable-list--horizontal {
  display: flex;
  align-items: center;
  justify-content: center;
}

.drag-sortable-list--horizontal__item:active {
  z-index: 1;
}

.drag-sortable-list--horizontal__item--drag-active {
  z-index: 1;
  background-color: var(--bg-color-1);
  box-shadow: 0 0 32px rgb(0, 0, 0, 0.2);
  transition: box-shadow 0.5s;
}
</style>