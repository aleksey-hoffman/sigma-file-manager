<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    class="workspace__area-container fade-in-1s"
    :style="workspaceAreaContainerStyle"
  >
    <component
      :is="item.component"
      v-for="(item, index) in workspaceAreas"
      :key="'workspace-area-' + index"
      class="workspace__area"
    />
  </div>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'
import SearchWorkspaceArea from '@/components/Workspace/Areas/Search/index.vue'
import NavigatorWorkspaceArea from '@/components/Workspace/Areas/Navigator/index.vue'

export default {
  components: {
    SearchWorkspaceArea,
    NavigatorWorkspaceArea,
  },
  computed: {
    ...mapFields({
      globalSearchWidget: 'globalSearch.widget',
    }),
    ...mapGetters([
      'selectedDirItems',
      'isOnlyCurrentDirItemSelected',
    ]),
    workspaceAreas () {
      return [
        {
          component: SearchWorkspaceArea,
        },
        {
          component: NavigatorWorkspaceArea,
        },
      ]
    },
    workspaceAreaContainerStyle () {
      if (this.globalSearchWidget) {
        return {
          display: 'grid',
          'grid-template-columns': '50% 50%',
        }
      }
      else {
        return {
          display: 'grid',
          'grid-template-columns': '1fr',
        }
      }
    },
  },
}
</script>

<style>
.workspace__area-container {
  height: 100%;
}

.workspace__area {
  min-width: 0px;
}

.workspace__area[show-divider] {
  border-right: 1px solid var(--divider-color-2);
}
</style>