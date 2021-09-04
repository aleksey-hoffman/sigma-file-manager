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
        :class="{'is-visible': showDragOverOverlay(item)}"
        v-if="['dir', 'file', 'userDir', 'drive'].includes(type)"
      ></div>

      <div
        class="overlay--storage-bar--vertical-line"
        v-if="showStorageBar({item, type: 'vertical'})"
        :style="getStorageBarStyles({item, type: 'vertical'})"
      ></div>

      <div
        class="overlay--storage-bar--horizontal-line"
        v-if="showStorageBar({item, type: 'horizontal'})"
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

        <!-- card::thumb: {type: user-dir} -->
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
          <template v-if="!driveCardShowProgress || driveCardProgressType !== 'circular'">
            <v-icon
              class="basic-item-card__icon mt-1"
              :size="$utils.getDriveIcon(item).size"
            >{{$utils.getDriveIcon(item).icon}}
            </v-icon>
            <div 
              class="basic-item-card__progress__text"
              v-if="item.percentUsed"
            >
              {{item.percentUsed}}%
            </div>
          </template>

          <template
            class="basic-item-card__progress--circular"
            v-if="driveCardShowProgress && driveCardProgressType === 'circular'"
          >
            <v-icon
              class="basic-item-card__icon mt-1"
              v-if="!item.percentUsed"
              :size="$utils.getDriveIcon(item).size"
            >{{$utils.getDriveIcon(item).icon}}
            </v-icon>
            <v-progress-circular
              v-if="item.percentUsed"
              :value="`${item.percentUsed}`"
              size="40"
              width="2"
              :color="getStorageBarColors({item, type: 'circular'}).color"
            >
              <div 
                class="basic-item-card__progress__text"
                v-if="item.percentUsed"
              >
                {{item.percentUsed}}%
              </div>
            </v-progress-circular>
          </template>
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

      <!-- card::content: {type: user-dir} -->
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
      <transition name="fade-in" mode="out-in">
        <div
          class="basic-item-card__content"
          v-if="type === 'drive'"
          :key="item.titleSummary"
        >
            <div>
              <div class="basic-item-card__content__line-1">
                {{item.titleSummary}}
              </div>
            </div>
          <v-progress-linear
            v-if="item.percentUsed"
            v-show="driveCardShowProgress && driveCardProgressType === 'linearHorizontalCentered'"
            :value="`${item.percentUsed}`"
            height="3"
            :background-color="getStorageBarColors({item, type: 'linear'}).bgColor"
            :color="getStorageBarColors({item, type: 'linear'}).color"
            style="margin-top: 2px; margin-bottom: 4px"
          ></v-progress-linear>

          <div class="basic-item-card__content__line-2">
            {{item.infoSummary}}
          </div>
        </div>
      </transition>

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
import {mapFields} from 'vuex-map-fields'

export default {
  props: {
    items: Array,
    actions: Array,
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
      if (!params.item.percentUsed) {
        return false
      }
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
    isLowAvailableStorageSpace (item) {
      const threshold = 10 * 1024 * 1024 * 1024 // 10GB
      return item?.size?.free < threshold
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
    getStorageBarColors (params) {
      let colorMap = {
        circular: {
          background: 'rgb(255, 255, 255, 0.02)', 
          red: 'rgb(244, 67, 54, 0.18)', 
          teal: 'rgb(0, 150, 136, 0.35)'
        },
        linear: {
          background: 'rgb(0, 0, 0, 0.1)', 
          red: 'rgb(244, 67, 54, 0.18)', 
          teal: 'rgb(0, 150, 136, 0.25)'
        },
      }
      const color = this.isLowAvailableStorageSpace(params.item)
        ? colorMap[params.type].red
        : colorMap[params.type].teal
      return {
        color,
        bgColor: colorMap[params.type].background
      }
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
      this.$store.dispatch('OPEN_DIR_ITEM_FROM_PATH', params.item.path)
    }
  }
}
</script>

<style scoped>
.overlay--storage-bar--vertical-line {
  z-index: 1;
  position: absolute;
  bottom: 0;
  width: 6px;
  height: 100%;
}

.overlay--storage-bar--horizontal-line {
  z-index: 1;
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 4px;
}

.basic-item-card__container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: 48px;
  gap: 16px;
}

.basic-item-card__container[lines="2"] {
  grid-auto-rows: 64px;
}

.basic-item-card {
  z-index: 1;
  position: relative;
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 0px;
  align-items: center;
  padding-right: 12px;
  overflow: hidden;  /* clip overlay--storage-bar */
  border-radius: 8px;
  transition: all 0.3s ease-in-out;
  color: var(--color-6);
  background-color: var(--bg-color-1);
  /* background-color: rgb(var(--bg-color-1-value), 0.7); */
  /* flat style */
  box-shadow: 0px 3px 12px rgb(0, 0, 0, 0.1),
              0px 1px 4px rgb(0,0,0,0.05);
  /* neumorphic style */
  /* box-shadow: 0px 9px 18px rgba(0, 0, 0, 0.1),
            0px -9px 18px rgba(255, 255, 255, 0.03),
            4px 4px 8px -4px rgba(255, 255, 255, 0.04) inset; */
}

.basic-item-card[cursor="pointer"] {
  cursor: pointer;
}

.basic-item-card:hover {
  z-index: 2;
  /* flat style */
  transform: scale(1.04);
  box-shadow: 0px 22px 48px rgb(0,0,0,0.3),
              0px 1px 4px rgb(0,0,0,0.1);
  /* neumorphic style */
  /* transform: scale(1);
  box-shadow: -3px -14px 14px 2px rgb(255 255 255 / 2%) inset,
    2px 3px 4px 1px rgb(0 0 0 / 20%) inset; */

  transition: all 0.1s; /* Override "enter" transition timing */
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
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
  font-size: 13px;
}

.basic-item-card__progress__text {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
  color: var(--color-6);
  font-size: 12px;
}

.basic-item-card__actions
  .v-icon {
    z-index: 2;
    opacity: 0;
    color: var(--dir-item-card-icon-color) !important;
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
