<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <transition name="overlay--item-drag__transition">
    <div
      v-show="dirItemDragOverlay"
      class="overlay--item-drag"
      :style="{
        left: inputState.pointer.lastMousedownMoveEvent.clientX + 'px',
        top: inputState.pointer.lastMousedownMoveEvent.clientY + 'px'
      }"
    >
      <div class="overlay--item-drag__content">
        <div class="overlay--item-drag__description">
          {{overlayDescription}}
        </div>
        <div class="overlay--item-drag__icon">
          <v-icon size="20px">
            {{actionTypeIcon}}
          </v-icon>
        </div>
      </div>
      <div class="overlay--item-drag__subtitle">
        {{$t('drag.holdShiftToChangeMode')}}
      </div>
    </div>
  </transition>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import {mapGetters} from 'vuex'

export default {
  props: {
    overlappedDropTarget: {
      type: String,
      default: '',
    },
  },
  computed: {
    ...mapFields({
      inputState: 'inputState',
      dirItemDragOverlay: 'overlays.dirItemDrag',
    }),
    ...mapGetters([
      'selectedDirItems',
      'selectedDirItemsPaths',
      'someDialogIsOpened',
    ]),
    actionType () {
      return this.inputState.shift ? 'copy' : 'move'
    },
    actionTypeIcon () {
      return this.actionType === 'copy' ? 'far fa-copy' : 'mdi-content-duplicate'
    },
    overlayDescription () {
      const actionType = this.actionType === 'copy' ? this.$t('copy') : this.$t('move')
      const itemCount = this.selectedDirItems.length
      return `${actionType} ${this.$tc('item', itemCount)}`
    },
  },
}
</script>

<style>
.overlay--item-drag {
  z-index: 10;
  position: fixed;
  gap: 16px;
  padding: 6px 24px;
  background-color: rgb(159, 168, 218, 0.1);
  border: 2px solid rgb(159, 168, 218, 0.3);
  border-radius: 4px;
  backdrop-filter: blur(8px);
  box-shadow:
    0 10px 48px rgb(0,0,0,0.3),
    -4px 4px 10px rgb(0,0,0,0.05);
  pointer-events: none;
}

.overlay--item-drag__content {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #bdbdbd;
}

.overlay--item-drag__subtitle {
  color: var(--color-6);
  font-size: 12px;
}

#app
  .overlay--item-drag
    .v-icon {
      color: #bdbdbd;
    }
</style>