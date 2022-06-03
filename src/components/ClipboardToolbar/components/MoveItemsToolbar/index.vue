<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <SimpleToolbar
    title="Prepared for moving"
    :action-buttons="actionButtons"
  />
</template>

<script>
import ItemListMenu from '../ItemListMenu/index.vue'
import PasteButton from '../PasteButton/index.vue'
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
          text: 'paste',
          component: PasteButton,
          onClick: () => {},
        },
        {
          text: 'discard',
          tooltip: 'Discard items',
          icon: 'mdi-close',
          component: 'vBtn',
          onClick: () => this.$store.dispatch('CLEAR_FS_CLIPBOARD'),
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