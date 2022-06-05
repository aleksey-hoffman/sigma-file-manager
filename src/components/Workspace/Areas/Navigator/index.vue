<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <WorkspaceAreaToolbar />
    <WorkspaceAreaSortingToolbar />
    <FilterClearButton
      :filter-query="filterQuery"
      class="ml-6 mt-4 mb-1"
      @click="filterQuery = ''"
    />
    <WorkspaceAreaItemList />
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import FilterClearButton from '@/components/FilterClearButton/index.vue'
import WorkspaceAreaSortingToolbar from '@/components/SortingToolbar/index.vue'
import WorkspaceAreaToolbar from '@/components/Workspace/Areas/Navigator/Toolbar/index.vue'
import WorkspaceAreaItemList from '@/components/Workspace/Areas/Navigator/ItemList/index.vue'

export default {
  components: {
    FilterClearButton,
    WorkspaceAreaToolbar,
    WorkspaceAreaSortingToolbar,
    WorkspaceAreaItemList,
  },
  data () {
    return {
    }
  },
  async mounted () {
    this.$nextTick(() => {
      this.navigatorRouteIsLoaded = true
    })
  },
  beforeDestroy () {
    this.navigatorRouteIsLoaded = false
  },
  computed: {
    ...mapFields({
      navigatorRouteIsLoaded: 'navigatorRouteIsLoaded',
      filterQuery: 'filterField.view.navigator.query',
    }),
  },
}
</script>
