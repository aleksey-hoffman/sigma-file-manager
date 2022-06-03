<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <SimpleToolbar
    title="Selected"
    :action-buttons="actionButtons"
  />
</template>

<script>
import ItemListMenu from '../ItemListMenu/index.vue'
import MenuButton from '../MenuButton/index.vue'
import SimpleToolbar from '../SimpleToolbar/index.vue'

export default {
  components: {
    SimpleToolbar,
  },
  computed: {
    actionButtons () {
      return [
        {
          text: '',
          tooltip: 'Show items',
          icon: 'mdi-format-list-bulleted',
          component: ItemListMenu,
          type: 'selected',
          onClick: () => {},
        },
        {
          text: 'select all',
          tooltip: 'Select all items',
          icon: 'mdi-select-all',
          component: 'vBtn',
          onClick: () => this.$store.dispatch('SELECT_ALL_DIR_ITEMS'),
        },
        {
          text: 'deselect all',
          tooltip: 'Deselect all items',
          icon: 'mdi-select-off',
          component: 'vBtn',
          onClick: () => this.$store.dispatch('DESELECT_ALL_DIR_ITEMS'),
        },
        {
          text: 'menu',
          component: MenuButton,
          onClick: () => {},
        },
      ]
    },
  },
}
</script>