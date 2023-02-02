<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    class="mb-2"
  >
    <v-tooltip
      v-for="(drive, index) in drives"
      :key="`${index}-${drive.mount}`"
      right
    >
      <template #activator="{ on }">
        <v-layout
          v-ripple
          class="nav-panel__item"
          align-center
          v-on="on"
          @click="$store.dispatch('OPEN_DIR_ITEM_FROM_PATH', drive.path)"
        >
          <div class="nav-panel__item__indicator" />
          <div class="nav-panel__item__icon-container">
            <v-badge
              :value="showNavPanelDriveLetterOverlay(drive)"
              color="var(--nav-panel-drive-overlay-bg-color)"
              overlap
              bottom
              left
              offset-x="12px"
              offset-y="10px"
            >
              <v-icon
                class="nav-panel__item__icon"
                :size="$utils.getDriveIcon(drive).size"
              >
                {{$utils.getDriveIcon(drive).name}}
              </v-icon>
              <template #badge>
                <div
                  v-if="showNavPanelDriveLetterOverlay(drive)"
                  style="color: var(--nav-panel-drive-overlay-color)"
                >
                  {{navPanelDriveLetterOverlayContent(drive)}}
                </div>
              </template>
            </v-badge>
          </div>
          <transition name="slide-fade-left">
            <div v-if="!navigationPanelMiniVariant">
              <div
                v-if="drive.type === 'cloud'"
                class="nav-panel__item__title"
              >
                {{drive.titleSummary}}
              </div>
              <div
                v-else
                class="nav-panel__item__title mb-1"
              >
                <v-layout align-center>
                  <div class="nav-panel__storage-device__mount">
                    <span v-if="systemInfo.platform === 'win32'">
                      {{$t('drive')}} {{drive.Caption}}
                    </span>
                    <span class="text--sub-title-1 caption">
                      {{driveTitle(drive)}}
                    </span>
                  </div>
                </v-layout>
                <StorageDeviceProgressBar
                  v-if="drive.percentUsed"
                  :storage-device="drive"
                  class="nav-panel__storage-device__progress-bar"
                />
              </div>
            </div>
          </transition>
        </v-layout>
      </template>
      <span>
        <div>{{drive.titleSummary}}</div>
        <div>{{drive.infoSummary}}</div>
      </span>
    </v-tooltip>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import {mapGetters} from 'vuex'
import StorageDeviceProgressBar from '@/components/StorageDeviceProgressBar/StorageDeviceProgressBar.vue'

export default {
  components: {
    StorageDeviceProgressBar,
  },
  computed: {
    ...mapGetters([
      'systemInfo',
    ]),
    ...mapFields({
      drives: 'drives',
      navigationPanelMiniVariant: 'navigationPanel.miniVariant',
      navPanelDriveLetterOverlay: 'storageData.settings.overlays.navPanelDriveLetterOverlay.value',
    }),
  },
  methods: {
    driveTitle (drive) {
      return ` • ${drive.size.free && this.$utils.prettyBytes(drive.size.free, 1)} / ${this.$utils.prettyBytes(drive.size.total, 1)}`
    },
    showNavPanelDriveLetterOverlay (drive) {
      return this.$utils.platform === 'win32'
        ? this.navPanelDriveLetterOverlay && !drive.mount.includes('OneDrive')
        : false
    },
    navPanelDriveLetterOverlayContent (drive) {
      return this.$utils.platform === 'win32'
        ? drive.mount.replace(':/', '')
        : ''
    },
  },
}
</script>

<style>
.nav-panel__storage-device__mount {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.nav-panel__storage-device__progress-bar {
  margin-top: 2px;
}
</style>