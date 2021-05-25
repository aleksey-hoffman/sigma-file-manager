<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <div v-if="drives.length === 0">
      No drives found
    </div>
    <basic-item-card-iterator
      :items="drives"
      category="drive"
      type="drive"
      icon="mdi-file-outline"
      lines="2"
    ></basic-item-card-iterator>
  </div>
</template>

<script>
import { mapFields } from 'vuex-map-fields'

export default {
  data () {
    return {
    }
  },
  computed: {
    ...mapFields({
      drives: 'drives'
    })
  }
}
</script>

<style>

</style>
