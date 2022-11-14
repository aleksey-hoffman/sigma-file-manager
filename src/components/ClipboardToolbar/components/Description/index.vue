<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div class="clipboard-toolbar__description">
    <span class="clipboard-toolbar__description-title">
      {{itemListDescription}}
    </span>
    <span class="clipboard-toolbar__description-size">
      <template v-if="isGettingSize">
        <v-progress-circular
          indeterminate
          size="16"
          width="2"
          color="primary"
          class="mx-3"
        />
      </template>
      <template v-else>
        {{$utils.prettyBytes(clipboardItemSize)}}
      </template>
    </span>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import {mapGetters} from 'vuex'

export default {
  props: {
    title: {
      type: String,
      default: '',
    },
  },
  computed: {
    ...mapFields({
      fsClipboard: 'navigatorView.clipboard.fs',
      isGettingSize: 'navigatorView.clipboard.isGettingSize',
      clipboardItemSize: 'navigatorView.clipboard.clipboardItemSize',
    }),
    ...mapGetters([
      'selectedDirItems',
    ]),
    itemListDescription () {
      const itemCount = this.clipboardToolbarType === 'selected'
        ? this.selectedDirItems.length
        : this.fsClipboard.items.length
      const itemCountText = this.$tc('item', itemCount)
      const longDescription = `${this.title}: ${itemCountText} • Total size:`
      const shortDescription = `${itemCountText} • Total size:`
      return this.$vuetify.breakpoint.mdAndUp
        ? longDescription
        : shortDescription
    },
    clipboardToolbarType () {
      let isSelectedItemsToolbar = this.selectedDirItems.length > 1 &&
        this.fsClipboard.items.length === 0
      return isSelectedItemsToolbar
        ? 'selected'
        : this.fsClipboard.type
    },
  },
}
</script>
