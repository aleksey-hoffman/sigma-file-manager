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
          'item-card__progress-glow--green': !isLowAvailableStorageSpace(),
          'item-card__progress-glow--red': isLowAvailableStorageSpace()
        }"
        :style="getStorageBarStyles('vertical')"
      />

      <div
        v-if="showStorageBar('horizontal')"
        class="item-card__progress--horizontal"
        :class="{
          'item-card__progress-glow--green': !isLowAvailableStorageSpace(),
          'item-card__progress-glow--red': isLowAvailableStorageSpace()
        }"
        :style="getStorageBarStyles('horizontal')"
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
              'drive-card__progress--circular--green': !isLowAvailableStorageSpace(),
              'drive-card__progress--circular--red': isLowAvailableStorageSpace()
            }"
          >
            <v-progress-circular
              v-if="drive.percentUsed"
              :value="`${drive.percentUsed}`"
              size="40"
              width="2"
              :color="getStorageBarColors('circular').color"
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
        <div
          v-if="showStorageBar('linear')"
          class="item-card__progress--horizontal-centered"
          :class="{
            'item-card__progress--horizontal-centered--green': !isLowAvailableStorageSpace(),
            'item-card__progress--horizontal-centered--red': isLowAvailableStorageSpace()
          }"
        >
          <v-progress-linear
            :value="`${drive.percentUsed}`"
            height="2"
            :background-color="getStorageBarColors('linear').bgColor"
            :color="getStorageBarColors('linear').color"
          />
        </div>
      </template>
    </ItemCard>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import ItemCard from '@/components/ItemCard/ItemCard.vue'

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
    isLowAvailableStorageSpace () {
      const thresholdPercent = 20
      return this.drive?.size?.percentUsed < thresholdPercent
    },
    getStorageBarStyles (type) {
      const width = `width: ${this.drive.percentUsed}%`
      const height = `height: ${this.drive.percentUsed}%`
      const colorRed = 'background-color: rgb(244, 67, 54, 0.18)'
      const colorTeal = 'background-color: rgb(0, 150, 136, 0.15)'
      const color = this.isLowAvailableStorageSpace()
        ? colorRed
        : colorTeal
      const selectedDirection = type === 'vertical'
        ? height
        : width
      return `${color}; ${selectedDirection}`
    },
    getStorageBarColors (type) {
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
      const color = this.isLowAvailableStorageSpace()
        ? colorMap[type].red
        : colorMap[type].teal
      return {
        color,
        bgColor: colorMap[type].background,
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

.item-card__progress-glow--green {
  box-shadow: 0px 0px 20px 6px rgb(0, 150, 136, 0.10);
}

.item-card__progress-glow--red {
  box-shadow: 0px 0px 20px 6px rgb(244, 67, 54, 0.10);
}

.item-card__progress--horizontal-centered {
  margin-top: 2px;
  margin-bottom: 4px;
}

.item-card__progress--horizontal-centered
  .v-progress-linear {
    overflow: unset;
  }

.item-card__progress--horizontal-centered
  .v-progress-linear
    .v-progress-linear__background {
      background-color: rgb(255, 255, 255, 0.05) !important;
    }

.item-card__progress--horizontal-centered--green
  .v-progress-linear
    .v-progress-linear__determinate {
      box-shadow: 0px 0px 20px 6px rgb(0, 150, 136, 0.10);
    }

.item-card__progress--horizontal-centered--red
  .v-progress-linear
    .v-progress-linear__determinate {
      box-shadow: 0px 0px 20px 6px rgb(244, 67, 54, 0.10);
    }

.drive-card__progress--circular
  .v-progress-circular__underlay {
    stroke: rgb(255, 255, 255, 0.05);
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