<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <basic-menu
    v-model="menus.tabs"
    :menuButton="{
      class: 'window-toolbar__item',
      tooltip: {
        description: 'Tabs',
        shortcut: shortcuts.switchTab.shortcut
      }
    }"
    :header="{
      title: 'Workspace tabs',
      icon: {
        name: 'mdi-tab',
        size: '18px',
        color: iconColor
      },
      buttons: [
        {
          icon: {
            name: 'mdi-close-box-multiple-outline',
            size: '22px'
          },
          tooltip: {
            description: 'Close all tabs in current workspace'
          },
          onClick: () => $store.dispatch('CLOSE_ALL_TABS_IN_CURRENT_WORKSPACE')
        }
      ]
    }"
  >
    <template v-slot:content>
      <sortable-list
        source="tabs"
        itemName="tab"
        noData="Current workspace has no tabs"
      ></sortable-list>
    </template>
  </basic-menu>
</template>

<script>
import { mapFields } from 'vuex-map-fields'

export default {
  props: {
    iconColor: String
  },
  computed: {
    ...mapFields({
      menus: 'menus',
      shortcuts: 'storageData.settings.shortcuts'
    })
  }
}
</script>
