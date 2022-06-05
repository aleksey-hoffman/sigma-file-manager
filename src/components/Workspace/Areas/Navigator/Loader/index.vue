<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div class="workspace__area-loader">
    <div v-if="!dirItemsInfoIsFetched">
      <div class="workspace__area-loader-line fade-in-1s">
        <v-progress-linear
          indeterminate
          color="var(--key-color-1)"
          height="1"
        />
      </div>
    </div>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  computed: {
    ...mapFields({
      dirItemsInfoIsFetched: 'navigatorView.dirItemsInfoIsFetched',
    }),
  },
}
</script>

<style>
.workspace__area-loader {
  position: relative;
}

.workspace__area-loader-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}
</style>