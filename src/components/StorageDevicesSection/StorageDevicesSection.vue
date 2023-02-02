<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <NoData
      title="placeholders.noDrivesFound"
      :show="drivesFormatted.length === 0"
    />
    <ItemGrid :lines="2">
      <DriveCard
        v-for="(drive, index) in drivesFormatted"
        :key="'device-card-' + index"
        :drive="drive"
      />
    </ItemGrid>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import NoData from '@/components/NoData/NoData.vue'
import ItemGrid from '@/components/ItemGrid/ItemGrid.vue'
import DriveCard from '@/components/DriveCard/DriveCard.vue'

export default {
  components: {
    NoData,
    ItemGrid,
    DriveCard,
  },
  computed: {
    ...mapFields({
      drives: 'drives',
    }),
    drivesFormatted () {
      return this.$utils.cloneDeep(this.drives).map(drive => {
        drive.infoSummary = this.$utils.getDriveSummary(drive)
        return drive
      })
    },
  },
}
</script>
