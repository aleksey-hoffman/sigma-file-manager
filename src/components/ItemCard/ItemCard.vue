<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    v-ripple
    class="item-card drop-target"
    :cursor="navigatorOpenDirItemWithSingleClick ? 'pointer' : 'default'"
    :design="itemCardDesign"
    :data-item-path="`${'item.path'}`"
    @click="itemCardOnClick()"
    @contextmenu="itemCardOnRightClick($event)"
    @dblclick="itemCardOnDoubleClick()"
  >
    <div
      class="overlay--drag-over"
      :class="{'is-visible': showDragOverOverlay()}"
    />

    <slot />

    <div class="item-card__preview">
      <slot name="preview" />
      <v-icon
        v-if="icon"
        class="item-card__icon"
        size="22px"
      >
        {{icon}}
      </v-icon>
    </div>
    <transition
      name="fade-in"
      mode="out-in"
    >
      <div
        :key="line1"
        class="item-card__content"
      >
        <div class="item-card__content-line-1">
          {{line1}}
        </div>
        <slot name="line-1-footer" />
        <div
          v-if="line2"
          class="item-card__content-line-2"
        >
          {{line2}}
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  props: {
    line1: {
      type: String,
      default: '',
    },
    line2: {
      type: String,
      default: '',
    },
    icon: {
      type: String,
      default: '',
    },
    name: {
      type: String,
      default: '',
    },
    path: {
      type: String,
      required: true,
    },
    lineAmount: {
      type: Number,
      default: 1,
    },
    targetType: {
      type: String,
      required: true,
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
    showDragOverOverlay () {
      return this.inputState.drag.type !== '' &&
        this.inputState.drag.moveActivationTresholdReached &&
        this.inputState.drag.overlappedDropTargetItem.path === this.path
    },
    itemCardOnClick () {
      if (this.navigatorOpenDirItemWithSingleClick) {
        this.$store.dispatch('OPEN_DIR_ITEM_FROM_PATH', this.path)
      }
    },
    itemCardOnDoubleClick () {
      this.$store.dispatch('OPEN_DIR_ITEM_FROM_PATH', this.path)
    },
    async itemCardOnRightClick (event) {
      const userDir = this.$utils.cloneDeep(this.appPaths.userDirs.find(userDirItem => userDirItem.name === this.name))
      this.$store.dispatch('openItemContextMenu', {
        x: event.clientX,
        y: event.clientY,
        item: userDir,
        path: this.path,
        targetType: this.targetType,
      })
    },
  },
}
</script>

<style>
.item-card {
  z-index: 1;
  position: relative;
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 0px;
  align-items: center;
  height: 100%;
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
  background-color: var(--neoinfusive-extruded-bg-color-1);
  box-shadow: var(--neoinfusive-extruded-shadow-1);
  border: 1px solid rgba(255, 255, 255, 0.0);
}

.item-card[design="neoinfusive-extruded"]:hover {
  background-color: rgba(0, 0, 0, 0);
  border: 1px solid var(--neoinfusive-extruded-bg-color-1);
  box-shadow: none;
}

.item-card[design="neoinfusive-flat-glow"] {
  background-color: var(--neoinfusive-flat-glow-bg-color-1);
}

.item-card[design="neoinfusive-flat-glow"]:hover {
  box-shadow: var(--neoinfusive-flat-glow-shadow-1--onhover);
  transform: scale(1.04);
}

.item-card__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.item-card__content {
  word-break: break-all;
}

.item-card__content-line-1 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
}

.item-card__content-line-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
  font-size: 13px;
}

.item-card__progress-text {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
  color: var(--color-6);
  font-size: 12px;
}

.item-card__icon {
  margin-top: 4px;
  color: var(--dir-item-card-icon-color) !important;
}
</style>