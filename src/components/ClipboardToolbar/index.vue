<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <transition-group name="slide-fade-up">
    <component
      :is="item.component"
      v-for="item in toolbars"
      :key="item.key"
    />
  </transition-group>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'
import SelectedItemsToolbar from './components/SelectedItemsToolbar/index.vue'
import CopyItemsToolbar from './components/CopyItemsToolbar/index.vue'
import MoveItemsToolbar from './components/MoveItemsToolbar/index.vue'

export default {
  components: {
    SelectedItemsToolbar,
    CopyItemsToolbar,
    MoveItemsToolbar,
  },
  watch: {
    selectedDirItems () {
      if (this.fsClipboard.items.length === 0) {
        this.getClipboardItemSize()
      }
    },
    'fsClipboard.items' () {
      this.getClipboardItemSize()
    },
  },
  computed: {
    ...mapFields({
      isGettingSize: 'navigatorView.clipboard.isGettingSize',
      clipboardItemSize: 'navigatorView.clipboard.clipboardItemSize',
      fsClipboard: 'navigatorView.clipboard.fs',
    }),
    ...mapGetters([
      'selectedDirItems',
    ]),
    isAllowedRoute () {
      return this.$route.name === 'navigator'
    },
    showSelectedItemsToolbar () {
      const isClipboardListEmpty = this.fsClipboard.items.length === 0
      const isSeveralDirItemsSelected = this.selectedDirItems.length > 1
      return isClipboardListEmpty && isSeveralDirItemsSelected && this.isAllowedRoute
    },
    showCopyItemsToolbar () {
      return this.fsClipboard.type === 'copy' && this.isAllowedRoute
    },
    showMoveItemsToolbar () {
      return this.fsClipboard.type === 'move' && this.isAllowedRoute
    },
    toolbars () {
      let items = [
        {
          component: SelectedItemsToolbar,
          ifCondition: this.showSelectedItemsToolbar,
        },
        {
          component: CopyItemsToolbar,
          ifCondition: this.showCopyItemsToolbar,
        },
        {
          component: MoveItemsToolbar,
          ifCondition: this.showMoveItemsToolbar,
        },
      ]
      return items
        .map((item, index) => {item.key = index; return item})
        .filter(item => item.ifCondition)
    },
  },
  methods: {
    async getClipboardItemSize () {
      const someToolbarIsShown = this.showSelectedItemsToolbar ||
        this.showCopyItemsToolbar ||
        this.showMoveItemsToolbar
      if (!someToolbarIsShown) {return}

      this.isGettingSize = true
      let totalSize = 0
      let results = await this.$store.dispatch('GET_ITEMS_SIZE', {
        items: this.selectedDirItems,
        options: {},
      })
      results.forEach(result => {totalSize += result.value.size})
      this.clipboardItemSize = totalSize
      this.isGettingSize = false
    },
  },
}
</script>
