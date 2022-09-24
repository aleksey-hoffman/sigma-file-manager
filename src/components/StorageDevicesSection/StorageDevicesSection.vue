<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <div v-if="drives.length === 0">
      No drives found
    </div>
    <ItemCardGrid :lines="2">
      <ItemCard
        v-for="(drive, index) in drives"
        :key="'device-card-' + index"
        :item="drive"
        :lines="2"
        target-type="drive"
      />
    </ItemCardGrid>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import ItemCardGrid from '@/components/ItemCardGrid/ItemCardGrid.vue'
import ItemCard from '@/components/ItemCard/ItemCard.vue'

export default {
  components: {
    ItemCardGrid,
    ItemCard,
  },
  computed: {
    ...mapFields({
      drives: 'drives',
    }),
  },
}
</script>
