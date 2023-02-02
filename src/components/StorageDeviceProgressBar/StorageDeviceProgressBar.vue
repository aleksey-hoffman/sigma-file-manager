<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    class="storage-device-progress-bar"
    :class="{
      'storage-device-progress-bar--green': !isLowFreeSpace,
      'storage-device-progress-bar--red': isLowFreeSpace
    }"
  >
    <v-progress-linear
      :value="`${storageDevice.percentUsed}`"
      :background-color="$utils.getCSSVar('--progress-bar-underlay-color')"
      :color="$utils.getCSSVar(isLowFreeSpace ? '--progress-bar-overlay-color-red' : '--progress-bar-overlay-color-green')"
      height="2"
    />
  </div>
</template>

<script>
export default {
  props: {
    storageDevice: {
      type: Object,
      default: () => {},
    },
  },
  computed: {
    isLowFreeSpace () {
      return this.$utils.isStorageDeviceLowFreeSpace(this.storageDevice)
    },
  },
}
</script>

<style>
.storage-device-progress-bar
  .v-progress-linear {
    overflow: unset;
  }

.storage-device-progress-bar
  .v-progress-linear
    .v-progress-linear__background {
      background-color: var(--progress-bar-underlay-color) !important;
    }

.storage-device-progress-bar--green
  .v-progress-linear
    .v-progress-linear__determinate {
      box-shadow: var(--progress-bar-shadow-green);
    }

.storage-device-progress-bar--red
  .v-progress-linear
    .v-progress-linear__determinate {
      box-shadow: var(--progress-bar-shadow-red);
    }

</style>