<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <div v-if="drives.length === 0">
      No drives found
    </div>

    <item-card-grid
      :lines="2"
    >
      <item-card
        v-for="(drive, index) in drives"
        :key="'device-card-' + index"
        :item="drive"
        :lines="2"
        targetType="drive"
      ></item-card>
    </item-card-grid>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  computed: {
    ...mapFields({
      drives: 'drives',
    }),
  },
}
</script>
