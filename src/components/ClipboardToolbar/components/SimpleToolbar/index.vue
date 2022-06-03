<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <ToolbarBase>
    <template #content>
      <Description :title="title" />
      <v-tooltip
        v-for="(button, index) in actionButtons"
        :key="'button-' + index"
        top
        :disabled="$vuetify.breakpoint.mdAndUp"
      >
        <template #activator="{ on, attrs }">
          <component
            :is="button.component"
            class="clipboard-toolbar__button"
            :text="$vuetify.breakpoint.mdAndUp"
            :icon="$vuetify.breakpoint.smAndDown"
            :type="button.type"
            small
            v-bind="attrs"
            @click="button.onClick"
            v-on="on"
          >
            <v-icon
              :size="button.iconSize || 16"
            >
              {{button.icon}}
            </v-icon>

            <div
              v-show="$vuetify.breakpoint.mdAndUp"
              class="ml-2"
              v-text="button.text"
            />
          </component>
        </template>
        <span>{{button.tooltip}}</span>
      </v-tooltip>
    </template>
  </ToolbarBase>
</template>

<script>
import ToolbarBase from '../ToolbarBase/index.vue'
import ItemListMenu from '../ItemListMenu/index.vue'
import PasteButton from '../PasteButton/index.vue'
import Description from '../Description/index.vue'

export default {
  components: {
    ToolbarBase,
    ItemListMenu,
    PasteButton,
    Description,
  },
  props: {
    title: {
      type: String,
      default: '',
    },
    actionButtons: {
      type: Array,
      default: () => ([]),
    },
  },
}
</script>