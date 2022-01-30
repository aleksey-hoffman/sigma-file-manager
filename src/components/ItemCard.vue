<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    class="item-card drop-target"
    @click="itemCardOnClick({event: $event, item})"
    @contextmenu="itemCardOnRightClick({event: $event, item})"
    @dblclick="itemCardOnDoubleClick({event: $event, item})"
    :lines="lines"
    :cursor="navigatorOpenDirItemWithSingleClick ? 'pointer' : 'default'"
    design="neoinfusive-extruded"
    v-ripple
  >
    <div
      class="overlay--drag-over"
      :class="{'is-visible': showDragOverOverlay(item)}"
      v-if="['dir', 'file', 'userDir', 'drive'].includes(targetType)"
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

    <div class="item-card__thumb">
      <div
        class="item-card__thumb__inner"
        v-if="targetType === 'userDir'"
      >
        <v-icon
          class="item-card__icon"
          size="22px"
        >{{item.icon}}
        </v-icon>
      </div>

      <div
        class="item-card__thumb__inner"
        v-if="targetType === 'drive'"
      >
        <template
          v-if="!driveCardShowProgress || driveCardProgressType !== 'circular'"
        >
          <v-icon
            class="item-card__icon mt-1"
            :size="$utils.getDriveIcon(item).size"
          >{{$utils.getDriveIcon(item).icon}}
          </v-icon>
          <div
            class="item-card__progress__text"
            v-if="item.percentUsed"
          >
            {{item.percentUsed}}%
          </div>
        </template>

        <template
          class="item-card__progress--circular"
          v-if="driveCardShowProgress && driveCardProgressType === 'circular'"
        >
          <v-icon
            class="item-card__icon mt-1"
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
              class="item-card__progress__text"
              v-if="item.percentUsed"
            >
              {{item.percentUsed}}%
            </div>
          </v-progress-circular>
        </template>
      </div>
    </div>

    <div class="item-card__content">
      <div v-if="targetType === 'userDir'">
        <div class="item-card__content__line-1">
          {{item.name}}
          {{item.name === 'Home directory' && showUserNameOnUserHomeDir
            ? `| ${$utils.getPathBase(item.path)}`
            : ''
          }}
        </div>
      </div>

      <transition name="fade-in" mode="out-in">
        <div
          v-if="targetType === 'drive'"
          :key="item.titleSummary"
        >
          <div>
            <div class="item-card__content__line-1">
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

          <div class="item-card__content__line-2">
            {{item.infoSummary}}
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  props: {
    item: Object,
    targetType: String,
    lines: {
      type: Number,
      default: 1,
    },
  },
  computed: {
    ...mapFields({
      appPaths: 'storageData.settings.appPaths',
      inputState: 'inputState',
      driveCardProgressType: 'storageData.settings.driveCard.progressType',
      driveCardShowProgress: 'storageData.settings.driveCard.showProgress',
      showUserNameOnUserHomeDir: 'storageData.settings.showUserNameOnUserHomeDir',
      navigatorOpenDirItemWithSingleClick: 'storageData.settings.navigator.openDirItemWithSingleClick',
    }),
  },
  methods: {
    showStorageBar (params) {
      if (!params.item.percentUsed) {
        return false
      }
      if (params.type === 'vertical') {
        return this.targetType === 'drive' &&
          this.driveCardShowProgress &&
          this.driveCardProgressType === 'linearVertical'
      }
      else if (params.type === 'horizontal') {
        return this.targetType === 'drive' &&
          this.driveCardShowProgress &&
          this.driveCardProgressType === 'linearHorizontal'
      }
      else {
        return false
      }
    },
    showDragOverOverlay (item) {
      if (this.targetType === 'dir' || this.targetType === 'file' || this.targetType === 'userDir') {
        return this.$store.getters.itemDragIsActive &&
          this.inputState.pointer.overlappedDropTargetItem.path === item.path
      }
      if (this.targetType === 'drive') {
        return this.$store.getters.itemDragIsActive &&
          this.inputState.pointer.overlappedDropTargetItem.path === item.mount
      }
    },
    isLowAvailableStorageSpace (item) {
      const threshold = 10 * 1024 ** 3 // 10GB
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
          teal: 'rgb(0, 150, 136, 0.35)',
        },
        linear: {
          background: 'rgb(0, 0, 0, 0.1)',
          red: 'rgb(244, 67, 54, 0.18)',
          teal: 'rgb(0, 150, 136, 0.25)',
        },
      }
      const color = this.isLowAvailableStorageSpace(params.item)
        ? colorMap[params.type].red
        : colorMap[params.type].teal
      return {
        color,
        bgColor: colorMap[params.type].background,
      }
    },
    itemCardOnClick (params) {
      if (this.navigatorOpenDirItemWithSingleClick) {
        this.handleItemCardOnClick(params)
      }
    },
    async itemCardOnRightClick (params) {
      let dirItem = await this.$store.dispatch('GET_DIR_ITEM_INFO', params.item.path)
      this.$store.dispatch('DESELECT_ALL_DIR_ITEMS')
      this.$store.dispatch('ADD_TO_SELECTED_DIR_ITEMS', dirItem)
      this.$store.dispatch('SET_CONTEXT_MENU', {
        x: params.event.clientX,
        y: params.event.clientY,
        targetType: this.targetType,
        targetData: {item: params.item, dirItem, userDirs: this.appPaths.userDirs},
      })
    },
    itemCardOnDoubleClick (params) {
      this.handleItemCardOnClick(params)
    },
    handleItemCardOnClick (params) {
      this.$store.dispatch('OPEN_DIR_ITEM_FROM_PATH', params.item.path)
    },
  },
}
</script>

<style>
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

.item-card {
  z-index: 1;
  position: relative;
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 0px;
  align-items: center;
  padding-right: 12px;
  overflow: hidden;  /* clip overlay--storage-bar */
  color: var(--color-6);
  border-radius: 8px;
  transition: all 0.3s ease-in-out;
}

.item-card:hover {
  z-index: 2;
  transition: all 0s;
}

.item-card[cursor="pointer"] {
  cursor: pointer;
}

.item-card[design="neoinfusive-extruded"] {
  background-color: rgba(var(--bg-color-1-value), 0.4);
  box-shadow:
    0px -2px 8px rgba(255, 255, 255, 0.025),
    0px -16px 20px rgba(255, 255, 255, 0.015),

    0px 1px 2.2px rgba(0, 0, 0, 0.022),
    0px 2.4px 5.3px rgba(0, 0, 0, 0.032),
    0px 4.5px 10px rgba(0, 0, 0, 0.04),
    0px 8px 17.9px rgba(0, 0, 0, 0.048),
    0px 15px 33.4px rgba(0, 0, 0, 0.058),
    0px 36px 80px rgba(0, 0, 0, 0.08)
  ;

/*    0px -0.4px 0.6px rgba(255, 255, 255, 0.003),
      0px -1.1px 1.3px rgba(255, 255, 255, 0.004),
      0px -2px 2.5px rgba(255, 255, 255, 0.005),
      0px -3.6px 4.5px rgba(255, 255, 255, 0.006),
      0px -6.7px 8.4px rgba(255, 255, 255, 0.007),
      0px -16px 20px rgba(255, 255, 255, 0.01), */

    /* 0px 2px 8px rgba(0, 0, 0, 0.1),
    0px 16px 64px rgba(0, 0, 0, 0.2); */
  border: 1px solid rgba(255, 255, 255, 0.0);
}

.item-card[design="neoinfusive-extruded"]:hover {
  background: rgba(0, 0, 0, 0);
  border: 1px solid var(--neoinfusive-translucent-alt-1);
  box-shadow: none;
}

.item-card[design="neoinfusive-flat"] {
  background-color: var(--neoinfusive-translucent-alt-1);
}

.item-card[design="neoinfusive-flat"]:hover {
  box-shadow: var(--neoinfusive-translucent-shadow-onhover-alt-1);
  transform: scale(1.04);
}

.item-card__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.item-card__thumb__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.item-card__content {
  word-break: break-all;
}

.item-card__content__line-1 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
}

.item-card__content__line-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
  font-size: 13px;
}

.item-card__progress__text {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
  color: var(--color-6);
  font-size: 12px;
}

.item-card__actions
  .v-icon {
    z-index: 2;
    opacity: 0;
    color: var(--dir-item-card-icon-color) !important;
  }

.item-card:hover
  .item-card__actions
    .v-icon {
      opacity: 1;
    }

.item-card__icon {
  color: var(--dir-item-card-icon-color) !important;
}
</style>