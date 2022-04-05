<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div class="dir-item-row-grid" :type="row.items ? row.items[0].type : row.type">
    <!-- row::top-spacer-->
    <template v-if="row.type === 'top-spacer'">
      <div
        class="
          dir-item-node
          dir-item--spacer
          unselectable
        "
        :style="{height: `${row.height}px`}"
      ></div>
    </template>

    <!-- row::divider -->
    <template v-if="['directory-divider', 'file-divider'].includes(row.type)">
      <div
        :key="`dir-item-${row.path}`"
        class="dir-item-node dir-item--divider unselectable text--sub-title-1"
      >{{row.title}}
      </div>
    </template>

    <!-- row::dirItem -->
    <template v-if="['directory-row', 'file-row'].includes(row.type)">
      <dir-item
        v-for="(item, index) in row.items"
        :key="`dir-item-${item.path}`"
        :source="item"
        :index="index"
        :height="item.height"
        :type="item.type"
        :forceThumbLoad="forceThumbLoad"
        :status="status"
        :thumbLoadSchedule="thumbLoadSchedule"
        :thumbLoadingIsPaused="thumbLoadingIsPaused"
        @addToThumbLoadSchedule="$emit('addToThumbLoadSchedule', $event)"
        @removeFromThumbLoadSchedule="$emit('removeFromThumbLoadSchedule', $event)"
        :ref="'dirItem' + item.positionIndex"
        :row-type="row.type"
      ></dir-item>
    </template>

    <!-- row::bottom-spacer -->
    <template v-if="row.type === 'bottom-spacer'">
      <div
        class="
          dir-item-node
          dir-item--spacer
          unselectable
        "
        :style="{height: `${row.height}px`}"
      ></div>
    </template>
  </div>
</template>

<script>
import {mapGetters, mapState} from 'vuex'

export default {
  name: 'dir-item-row',
  props: {
    rowIndex: Number,
    row: Object,
    type: String,
    forceThumbLoad: Boolean,
    status: Object,
    thumbLoadSchedule: Array,
    thumbLoadingIsPaused: Boolean
  },
  data () {
    return {
      dirItemAwaitsSecondClick: false,
      dirItemAwaitsSecondClickTimeout: null,
      dirItemSecondClickDelay: 500
    }
  },
  computed: {
    ...mapState({
      navigatorLayout: state => state.storageData.settings.navigatorLayout
    }),
    ...mapGetters([
      'selectedDirItems',
      'selectedDirItemsPaths'
    ])
  }
}
</script>

<style>
.dir-item-row-grid[type="directory"],
.dir-item-row-grid[type="directory-symlink"] {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: 64px;
  gap: 24px;
}

.dir-item-row-grid[type="file"],
.dir-item-row-grid[type="file-symlink"]  {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: 158px;
  gap: 24px;
}

</style>
