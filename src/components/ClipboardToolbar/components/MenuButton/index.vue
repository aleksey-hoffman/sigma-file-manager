<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-tooltip
    top
    :disabled="$vuetify.breakpoint.mdAndUp"
  >
    <template #activator="{on}">
      <div v-on="on">
        <v-btn
          class="clipboard-toolbar__button"
          :text="$vuetify.breakpoint.mdAndUp"
          :icon="$vuetify.breakpoint.smAndDown"
          small
          @click="toggleCurrentDirContextMenu"
        >
          <v-icon
            size="14"
            class="css-override"
          >
            mdi-dots-vertical
          </v-icon>
          <div
            v-show="$vuetify.breakpoint.mdAndUp"
            class="ml-2"
          >
            {{$t('menu')}}
          </div>
        </v-btn>
      </div>
    </template>
    <span>{{$t('contextMenu')}}</span>
  </v-tooltip>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  computed: {
    ...mapFields({
      contextMenus: 'contextMenus',
    }),
  },
  methods: {
    toggleCurrentDirContextMenu (event) {
      this.contextMenus.dirItem.x = event.clientX + 12
      this.contextMenus.dirItem.y = event.clientY
      this.contextMenus.dirItem.value = !this.contextMenus.dirItem.value
    },
  },
}
</script>
