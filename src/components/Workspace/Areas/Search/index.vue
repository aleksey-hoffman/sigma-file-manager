<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    v-show="globalSearchWidget"
    :show-divider="globalSearchWidget"
  >
    <GlobalSearch />
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import GlobalSearch from '@/components/GlobalSearch/index.vue'

export default {
  components: {
    GlobalSearch,
  },
  computed: {
    ...mapFields({
      globalSearchWidget: 'globalSearch.widget',
    }),
  },
}
</script>
