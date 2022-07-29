<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <transition name="fade-in">
    <div
      v-show="showInboundDragOverlay"
      class="overlay--inbound-drag"
      @click="showInboundDragOverlay = false"
    >
      <div class="overlay--inbound-drag__title">
        {{overlayData.title}}
      </div>
      <div
        v-if="overlayData.allowedTypes"
        class="overlay--inbound-drag__sub-title"
      >
        {{overlayData.allowedTypes}}
      </div>
      <div
        v-if="overlayData.modeInstructions"
        class="overlay--inbound-drag__sub-title"
      >
        {{overlayData.modeInstructions}}
      </div>
      <div class="overlay--inbound-drag__sub-title">
        Hit [Esc] button or click here to cancel
      </div>
    </div>
  </transition>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

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
      showInboundDragOverlay: 'overlays.inboundDrag',
    }),
    overlayData () {
      if (this.overlappedDropTarget === 'navigator::currentDir') {
        let title = ''
        if (this.inputState.drag.targetType === 'existing-path') {
          title = this.inputState.shift
            ? 'Drop here to copy into the current directory'
            : 'Drop here to move into the current directory'
        }
        else {
          title = this.inputState.shift
            ? 'Drop here to download into the current directory'
            : 'Drop here to download into the current directory'
        }
        return {
          title,
          modeInstructions: 'Hold CTRL for selective drop mode',
        }
      }
      else if (this.overlappedDropTarget === 'homePageBanner::customMedia') {
        return {
          title: 'Drop here to copy file and add custom media',
          allowedTypes: 'file, path, URL',
          modeInstructions: '',
        }
      }
      else {
        return {}
      }
    },
  },
}
</script>

<style>
.overlay--inbound-drag {
  position: fixed;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgb(81, 110, 176, 0.2);
  outline: 4px dashed #fafafa;
  outline-offset: -4px;
  backdrop-filter: blur(8px);
}

.overlay--inbound-drag__title {
  user-select: none;
  pointer-events: none;
  color: #fafafa;
  font-size: 24px;
}

.overlay--inbound-drag__sub-title {
  user-select: none;
  pointer-events: none;
  color: #e0e0e0;
}
</style>