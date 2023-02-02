<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <ItemCard
      :line1="drive.titleSummary"
      :line2="drive.infoSummary"
      :path="drive.path"
      target-type="drive"
    >
      <div
        v-if="showStorageBar('vertical')"
        class="item-card__progress--vertical"
        :class="{
          'item-card__progress--vertical--green item-card__progress-glow--green': !isLowFreeSpace,
          'item-card__progress--vertical--red item-card__progress-glow--red': isLowFreeSpace,
        }"
        :style="[
          `height: ${drive.percentUsed}%`
        ]"
      />

      <div
        v-if="showStorageBar('horizontal')"
        class="item-card__progress--horizontal"
        :class="{
          'item-card__progress-glow--green': !isLowFreeSpace,
          'item-card__progress-glow--red': isLowFreeSpace
        }"
        :style="[
          `width: ${drive.percentUsed}%`
        ]"
      />

      <template #preview>
        <template
          v-if="!driveCardShowProgress || driveCardProgressType !== 'circular'"
        >
          <v-icon
            class="item-card__icon"
            :size="$utils.getDriveIcon(drive).size"
          >
            {{$utils.getDriveIcon(drive).name}}
          </v-icon>
          <div
            v-if="drive.percentUsed"
            class="item-card__progress-text"
          >
            {{drive.percentUsed}}%
          </div>
        </template>

        <template
          v-if="driveCardShowProgress && driveCardProgressType === 'circular'"
        >
          <v-icon
            v-if="!drive.percentUsed"
            class="item-card__icon"
            :size="$utils.getDriveIcon(drive).size"
          >
            {{$utils.getDriveIcon(drive).name}}
          </v-icon>
          <div
            class="drive-card__progress--circular"
            :class="{
              'drive-card__progress--circular--green': !isLowFreeSpace,
              'drive-card__progress--circular--red': isLowFreeSpace
            }"
          >
            <v-progress-circular
              v-if="drive.percentUsed"
              :value="`${drive.percentUsed}`"
              size="40"
              width="2"
              :color="$utils.getCSSVar(isLowFreeSpace ? '--progress-bar-overlay-color-red' : '--progress-bar-overlay-color-green')"
            >
              <div
                v-if="drive.percentUsed"
                class="item-card__progress-text"
              >
                {{drive.percentUsed}}%
              </div>
            </v-progress-circular>
          </div>
        </template>
      </template>

      <template #line-1-footer>
        <StorageDeviceProgressBar
          v-if="showStorageBar('linear')"
          :storage-device="drive"
          class="item-card__progress--horizontal-centered"
        />
      </template>
    </ItemCard>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import ItemCard from '@/components/ItemCard/ItemCard.vue'
import StorageDeviceProgressBar from '@/components/StorageDeviceProgressBar/StorageDeviceProgressBar.vue'

export default {
  props: {
    drive: {
      type: Object,
      default: () => ({
        titleSummary: {
          type: String,
          default: '',
        },
        infoSummary: {
          type: String,
          default: '',
        },
        iconDescription: {
          type: String,
          default: '',
        },
        path: {
          type: String,
          default: '',
        },
      }),
    },
  },
  components: {
    ItemCard,
    StorageDeviceProgressBar,
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
    isLowFreeSpace () {
      return this.$utils.isStorageDeviceLowFreeSpace(this.drive)
    },
  },
  methods: {
    showStorageBar (type) {
      if (!this.drive.percentUsed || !this.driveCardShowProgress) {
        return false
      }
      if (type === 'vertical') {
        return this.driveCardProgressType === 'linearVertical'
      }
      else if (type === 'horizontal') {
        return this.driveCardProgressType === 'linearHorizontal'
      }
      else if (type === 'linear') {
        return this.driveCardProgressType === 'linearHorizontalCentered'
      }
      else {
        return false
      }
    },
  },
}
</script>

<style>
.item-card__progress--vertical {
  z-index: 1;
  position: absolute;
  bottom: 0;
  width: 4px;
  height: 100%;
}

.item-card__progress--horizontal {
  z-index: 1;
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 4px;
}

.item-card__progress--vertical--green {
  background-color: var(--progress-bar-overlay-color-green);
}

.item-card__progress--vertical--red {
  background-color: var(--progress-bar-overlay-color-red);
}

.item-card__progress-glow--green {
  box-shadow: var(--progress-bar-shadow-green);
}

.item-card__progress-glow--red {
  box-shadow: var(--progress-bar-shadow-red);
}

.item-card__progress--horizontal-centered {
  margin-top: 2px;
  margin-bottom: 4px;
}

.drive-card__progress--circular
  .v-progress-circular__underlay {
    stroke: var(--progress-bar-underlay-color);
  }

.drive-card__progress--circular
  svg {
    overflow: unset;
  }

.drive-card__progress--circular--green
  .v-progress-circular__overlay {
    filter: drop-shadow(0px 2px 6px rgb(0, 150, 136, 1));
  }

.drive-card__progress--circular--red
  .v-progress-circular__overlay {
    filter: drop-shadow(0px 2px 6px rgb(244, 67, 54, 1));
  }
</style>