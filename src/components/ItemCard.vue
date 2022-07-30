<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    v-ripple
    class="item-card drop-target"
    :lines="lines"
    :cursor="navigatorOpenDirItemWithSingleClick ? 'pointer' : 'default'"
    :design="itemCardDesign"
    :data-item-path="`${item.path}`"
    @click="itemCardOnClick({event: $event, item})"
    @contextmenu="itemCardOnRightClick({event: $event, item})"
    @dblclick="itemCardOnDoubleClick({event: $event, item})"
  >
    <div
      v-if="['dir', 'file', 'userDir', 'drive'].includes(targetType)"
      class="overlay--drag-over"
      :class="{'is-visible': showDragOverOverlay(item)}"
    />

    <div
      v-if="showStorageBar({item, type: 'vertical'})"
      class="overlay--storage-bar--vertical-line"
      :style="getStorageBarStyles({item, type: 'vertical'})"
    />

    <div
      v-if="showStorageBar({item, type: 'horizontal'})"
      class="overlay--storage-bar--horizontal-line"
      :style="getStorageBarStyles({item, type: 'horizontal'})"
    />

    <div class="item-card__thumb">
      <div
        v-if="targetType === 'userDir'"
        class="item-card__thumb__inner"
      >
        <v-icon
          class="item-card__icon"
          size="22px"
        >
          {{item.icon}}
        </v-icon>
      </div>

      <div
        v-if="targetType === 'drive'"
        class="item-card__thumb__inner"
      >
        <template
          v-if="!driveCardShowProgress || driveCardProgressType !== 'circular'"
        >
          <v-icon
            class="item-card__icon mt-1"
            :size="$utils.getDriveIcon(item).size"
          >
            {{$utils.getDriveIcon(item).icon}}
          </v-icon>
          <div
            v-if="item.percentUsed"
            class="item-card__progress__text"
          >
            {{item.percentUsed}}%
          </div>
        </template>

        <template
          v-if="driveCardShowProgress && driveCardProgressType === 'circular'"
          class="item-card__progress--circular"
        >
          <v-icon
            v-if="!item.percentUsed"
            class="item-card__icon mt-1"
            :size="$utils.getDriveIcon(item).size"
          >
            {{$utils.getDriveIcon(item).icon}}
          </v-icon>
          <v-progress-circular
            v-if="item.percentUsed"
            :value="`${item.percentUsed}`"
            size="40"
            width="2"
            :color="getStorageBarColors({item, type: 'circular'}).color"
          >
            <div
              v-if="item.percentUsed"
              class="item-card__progress__text"
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
          {{item.title}}
        </div>
      </div>

      <transition
        name="fade-in"
        mode="out-in"
      >
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
          />

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
    item: {
      type: Object,
      default: () => ({}),
    },
    targetType: {
      type: String,
      default: '',
    },
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
      navigatorOpenDirItemWithSingleClick: 'storageData.settings.navigator.openDirItemWithSingleClick',
      itemCardDesign: 'storageData.settings.itemCardDesign',
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
    showDragOverOverlay (dirItem) {
      return this.inputState.drag.type !== '' &&
        this.inputState.drag.moveActivationTresholdReached &&
        this.inputState.drag.overlappedDropTargetItem.path === dirItem.path
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
      const sourceUserDirItem = this.appPaths.userDirs.find(userDirItem => userDirItem.name === params.item.name)
      this.$store.dispatch('SET_CONTEXT_MENU', {
        x: params.event.clientX,
        y: params.event.clientY,
        targetType: this.targetType,
        targetData: {item: sourceUserDirItem, dirItem, userDirs: this.appPaths.userDirs},
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
  transition: var(--item-card-transition);
}

.item-card:hover {
  z-index: 2;
  transition: all 0s;
}

.item-card[cursor="pointer"] {
  cursor: pointer;
}

.item-card[optimized] {
  box-shadow: none !important;
  transition: none !important;
}

.item-card[design="neoinfusive-extruded"] {
  background-color: var(--item-card-color--neoinfusive-extruded-1);
  box-shadow: var(--item-card-shadow--neoinfusive-extruded-1);
  border: 1px solid rgba(255, 255, 255, 0.0);
}

.item-card[design="neoinfusive-extruded"]:hover {
  background-color: rgba(0, 0, 0, 0);
  border: 1px solid var(--item-card-color--neoinfusive-extruded-1);
  box-shadow: none;
}

.item-card[design="neoinfusive-flat-glow"] {
  background-color: var(--item-card-color--neoinfusive-flat-glow-1);
  box-shadow: var(--item-card-shadow--neoinfusive-extruded);
}

.item-card[design="neoinfusive-flat-glow"]:hover {
  box-shadow: var(--item-card-shadow-onhover--neoinfusive-flat-glow-1);
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