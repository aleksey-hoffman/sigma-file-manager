<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    class="basic-item-card__container"
    :lines="lines"
  >
    <div
      class="basic-item-card drop-target"
      v-for="(item, index) in items"
      @click="handleClick({event: $event, item})"
      @dblclick="handleDoubleClick({event: $event, item})"
      :key="'basic-item-card-' + index"
      :data-item-path="type === 'drive' ? item.mount : item.path"
      :lines="lines"
      :cursor="navigatorOpenDirItemWithSingleClick ? 'pointer' : 'default'"
      v-ripple
    >
      <!-- card::overlays -->
      <div
        class="overlay--drag-over"
        v-if="['dir', 'file', 'userDir', 'drive'].includes(type)"
        :class="{'is-visible': showDragOverOverlay(item)}"
      ></div>

      <div
        class="overlay--storage-bar--vertical-line"
        v-if="showStorageBar({type: 'vertical'})"
        :style="getStorageBarStyles({item, type: 'vertical'})"
      ></div>

      <div
        class="overlay--storage-bar--horizontal-line"
        v-if="showStorageBar({type: 'horizontal'})"
        :style="getStorageBarStyles({item, type: 'horizontal'})"
      ></div>

      <!-- card::thumb -->
      <div class="basic-item-card__thumb">
        <!-- card::thumb: {type: dir} -->
        <v-icon
          class="basic-item-card__icon"
          v-show="type === 'dir'"
          size="26px"
        >{{icon}}
        </v-icon>

        <!-- card::thumb: {type: file} -->
        <div
          class="basic-item-card__thumb__inner"
          v-if="type === 'file'"
        >
          <v-icon
            class="basic-item-card__icon mt-2"
            size="22px"
          >{{icon}}
          </v-icon>
          <div class="caption">
            {{$utils.getExt(item.path)}}
          </div>
        </div>

        <!-- card::thumb: {type: system-dir} -->
        <div
          class="basic-item-card__thumb__inner"
          v-if="type === 'userDir'"
        >
          <v-icon
            class="basic-item-card__icon"
            size="22px"
          >{{item.icon}}
          </v-icon>
        </div>

        <!-- card::thumb: {type: drive} -->
        <div
          class="basic-item-card__thumb__inner"
          v-if="type === 'drive'"
        >
          <div v-if="!driveCardShowProgress || driveCardProgressType !== 'circular'">
            <v-icon
              class="basic-item-card__icon mt-1"
              size="22px"
            >{{getThumbIcon(item)}}
            </v-icon>
            <div class="basic-item-card__progress--circular__text">
              {{item.percentUsed}}%
            </div>
          </div>

          <div
            class="basic-item-card__progress--circular"
            v-show="driveCardShowProgress && driveCardProgressType === 'circular'"
          >
            <v-progress-circular
              :value="`${item.percentUsed}`"
              size="40"
              width="2"
              :color="getStorageBarColor({item, type: 'circular'})"
            >
              <div class="basic-item-card__progress--circular__text">
                {{item.percentUsed}}%
              </div>
            </v-progress-circular>
          </div>
        </div>
      </div>

      <!-- card::content: {type: (file|dir)} -->
      <div
        class="basic-item-card__content"
        v-if="type === 'file' || type === 'dir'"
      >
        <div class="basic-item-card__content__line-1">
          {{$utils.getPathBase(item.path)}}
        </div>
        <div class="basic-item-card__content__line-2">
          <span>Drive</span>
          {{$utils.getPathRoot(item.path)}}
        </div>
      </div>

      <!-- card::content: {type: system-dir} -->
      <div
        class="basic-item-card__content"
        v-if="type === 'userDir'"
      >
        <div class="basic-item-card__content__line-1">
          {{item.name}}
          {{item.name === 'Home directory' && showUserNameOnUserHomeDir
            ? `| ${$utils.getPathBase(item.path)}`
            : ''
         }}
        </div>
      </div>

      <!-- card::content: {type: (drive|dir)} -->
      <div
        v-if="type === 'drive'"
        class="basic-item-card__content"
      >
        <div class="basic-item-card__content__line-1">
          {{item.titleSummary}}
        </div>

        <v-progress-linear
          v-show="driveCardShowProgress && driveCardProgressType === 'linearHorizontalCentered'"
          :value="`${item.percentUsed}`"
          height="3"
          :background-color="$utils.getCSSVar('--bg-color-2')"
          :color="getStorageBarColor({item, type: 'circular'})"
          style="margin-top: 2px; margin-bottom: 4px"
        ></v-progress-linear>

        <div class="basic-item-card__content__line-2">
          {{item.infoSummary}}
        </div>
      </div>

      <!-- card::actions -->
      <div
        v-if="actions && actions.length > 0"
        class="basic-item-card__actions"
      >
        <v-btn
          v-for="(action, index) in actions"
          :key="'action-' + index"
          icon
        >
          <v-icon
            @dblclick.prevent.stop=""
            @click.prevent.stop="action.onClick"
          >{{action.icon}}
          </v-icon>
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script>
import { mapFields } from 'vuex-map-fields'

export default {
  props: {
    items: Array,
    actions: Array,
    category: String,
    type: String,
    icon: String,
    lines: String
  },
  computed: {
    ...mapFields({
      inputState: 'inputState',
      driveCardProgressType: 'storageData.settings.driveCard.progressType',
      driveCardShowProgress: 'storageData.settings.driveCard.showProgress',
      showUserNameOnUserHomeDir: 'storageData.settings.showUserNameOnUserHomeDir',
      navigatorOpenDirItemWithSingleClick: 'storageData.settings.navigator.openDirItemWithSingleClick',
    })
  },
  methods: {
    showStorageBar (params) {
      if (params.type === 'vertical') {
        return this.type === 'drive' &&
          this.driveCardShowProgress &&
          this.driveCardProgressType === 'linearVertical'
      }
      else if (params.type === 'horizontal') {
        return this.type === 'drive' &&
          this.driveCardShowProgress &&
          this.driveCardProgressType === 'linearHorizontal'
      }
      else {
        return false
      }
    },
    showDragOverOverlay (item) {
      if (this.type === 'dir' || this.type === 'file' || this.type === 'userDir') {
        return this.$store.getters.itemDragIsActive &&
          this.inputState.pointer.hoveredItem.path === item.path
      }
      if (this.type === 'drive') {
        return this.$store.getters.itemDragIsActive &&
          this.inputState.pointer.hoveredItem.path === item.mount
      }
    },
    getThumbIcon (drive) {
      if (drive.type === 'rom') {
        return 'fas fa-compact-disc'
      }
      else if (drive.removable) {
        return 'fab fa-usb'
      }
      else {
        return 'far fa-hdd'
      }
    },
    isLowAvailableStorageSpace (item) {
      const lessThan10GBLeft = item.size.free < (10 * 1024 * 1024 * 1024)
      return lessThan10GBLeft
    },
    getStorageBarStyles (params) {
      const width = `width: ${params.item.percentUsed}%`
      const height = `height: ${params.item.percentUsed}%`
      const colorRed = 'background-color: rgb(244, 67, 54, 0.18)'
      const colorTeal = 'background-color: rgb(0, 150, 136, 0.15)'
      const color = this.isLowAvailableStorageSpace(params.item)
        ? colorRed
        : colorTeal
      const selectedDirection = params.type === 'vertical'
        ? height
        : width
      return `${color}; ${selectedDirection}`
    },
    getStorageBarColor (params) {
      const colorRed = 'rgb(244, 67, 54, 0.18)'
      const colorTeal = 'rgb(0, 150, 136, 0.15)'
      const color = this.isLowAvailableStorageSpace(params.item)
        ? colorRed
        : colorTeal
      return color
    },
    handleClick (params) {
      if (this.navigatorOpenDirItemWithSingleClick) {
        this.handleClickAction(params)
      }
    },
    handleDoubleClick (params) {
      this.handleClickAction(params)
    },
    handleClickAction (params) {
      if (['file', 'dir', 'userDir'].includes(this.type)) {
        this.$store.dispatch('OPEN_DIR_ITEM_FROM_PATH', params.item.path)
      }
      else if (this.type === 'drive') {
        this.$store.dispatch('LOAD_DIR', {path: params.item.mount})
      }
    }
  }
}
</script>

<style scoped>
.basic-item-card__container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: 48px;
  gap: 16px;
}

.basic-item-card__container[lines="2"] {
  grid-auto-rows: 64px;
}

.basic-item-card__progress--circular__text {
  color: var(--color-6);
  font-size: 12px;
}

.overlay--storage-bar--vertical-line {
  position: absolute;
  width: 6px;
  height: 100%;
  bottom: 0;
  z-index: 1;
}

.overlay--storage-bar--horizontal-line {
  position: absolute;
  width: 100%;
  height: 4px;
  bottom: 0;
  z-index: 1;
}

.basic-item-card {
  position: relative;
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 0px;
  align-items: center;
  padding-right: 12px;
  color: var(--color-6);
  overflow: hidden;  /* clip overlay--storage-bar */
  border-radius: 8px;
  transition: all 0.3s ease-in-out;
  background-color: var(--bg-color-1);
  /* flat style */
  box-shadow: 0px 3px 12px rgb(0, 0, 0, 0.1),
              0px 1px 4px rgb(0,0,0,0.05);
  /* neumorphic style */
  /* box-shadow: 0px 9px 18px rgba(0, 0, 0, 0.1),
            0px -9px 18px rgba(255, 255, 255, 0.03),
            4px 4px 8px -4px rgba(255, 255, 255, 0.04) inset; */
  z-index: 1;
}

.basic-item-card[cursor="pointer"] {
  cursor: pointer;
}

.basic-item-card:hover {
  box-shadow: 0px 22px 48px rgb(0,0,0,0.3),
              0px 1px 4px rgb(0,0,0,0.1);
  transform: scale(1.04);
  transition: all 0.1s; /* Override "enter" transition timing */
  z-index: 2;
}

.basic-item-card__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.basic-item-card__thumb__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.basic-item-card__content {
  word-break: break-all;
}

.basic-item-card__content__line-1 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
}

.basic-item-card__content__line-2 {
  font-size: 13px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
}

.basic-item-card__actions
  .v-icon {
    opacity: 0;
    color: var(--dir-item-card-icon-color) !important;
    z-index: 2;
  }

.basic-item-card:hover
  .basic-item-card__actions
    .v-icon {
      opacity: 1;
    }

.basic-item-card__icon {
  color: var(--dir-item-card-icon-color) !important;
}
</style>
