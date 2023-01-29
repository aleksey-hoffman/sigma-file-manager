<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <div v-if="component === 'lastScanTimeElapsed'">
      <div>
        <v-icon
          class="action-toolbar__icon mr-2"
          size="18px"
        >
          mdi-magnify-scan
        </v-icon>
        {{$t('globalSearch.lastScan')}}: {{Math.floor(lastScanTimeElapsed / 1000 / 60)}} {{$t('globalSearch.minutesAgo')}}.
      </div>
    </div>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  props: ['component'],
  computed: {
    ...mapFields({
      lastScanTimeElapsed: 'globalSearch.lastScanTimeElapsed',
    }),
  },
}
</script>
