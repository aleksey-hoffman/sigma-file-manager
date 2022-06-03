<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-tooltip
    top
    :disabled="!(fsClipboard.type === 'move' && !pasteItemsState.enabled)"
  >
    <template #activator="{on}">
      <div v-on="on">
        <v-btn
          class="clipboard-toolbar__button"
          :disabled="!pasteItemsState.enabled"
          :text="$vuetify.breakpoint.mdAndUp"
          :icon="$vuetify.breakpoint.smAndDown"
          small
          @click="$store.dispatch('PASTE_FS_CLIPBOARD_DIR_ITEMS')"
        >
          <v-icon
            size="14"
            class="css-override"
          >
            mdi-content-paste
          </v-icon>
          <div
            v-show="$vuetify.breakpoint.mdAndUp"
            class="ml-2"
          >
            {{buttonText}}
          </div>
        </v-btn>
      </div>
    </template>
    <span>{{pasteItemsState.tooltipText}}</span>
  </v-tooltip>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
const PATH = require('path')

export default {
  props: {
    tooltip: {
      type: String,
      default: '',
    },
  },
  computed: {
    ...mapFields({
      currentDir: 'navigatorView.currentDir',
      fsClipboard: 'navigatorView.clipboard.fs',
    }),
    pasteItemsState () {
      if (this.fsClipboard.type === 'move') {
        const enabled = !this.fsClipboard.items.some(item => {
          return this.currentDir.path === PATH.parse(item.path).dir
        })
        return {
          enabled,
          tooltipText: enabled ? 'Paste items to this directory' : 'Dir items are already located in this directory',
        }
      }
      else {
        return {
          enabled: true,
          tooltipText: 'Paste items to this directory',
        }
      }
    },
    buttonText () {
      if (this.fsClipboard.type === 'copy') {
        return 'Copy all here'
      }
      else if (this.fsClipboard.type === 'move') {
        return 'Move all here'
      }
      else {
        return ''
      }
    },
  },
}
</script>
