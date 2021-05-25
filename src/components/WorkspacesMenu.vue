<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <basic-menu
    v-model="menus.workspaces"
    :menuButton="{
      class: 'window-toolbar__item',
      tooltip: {
        description: 'Workspaces',
        shortcut: shortcuts.switchWorkspace.shortcut
      }
    }"
    :header="{
      title: 'Workspaces',
      icon: {
        name: `mdi-numeric-${selectedWorkspace.id + 1}-box-multiple-outline`,
        size: '18px',
        color: iconColor
      },
      buttons: [
        {
          icon: {
            name: 'mdi-pencil-outline',
            size: '20px'
          },
          tooltip: {
            description: 'Edit workspaces'
          },
          onClick: () => $store.state.dialogs.workspaceEditorDialog.value = true
        }
      ]
    }"
  >
    <template v-slot:content>
      <sortable-list
        source="workspaces"
        itemName="workspace"
        noData="Current workspace has no tabs"
      ></sortable-list>
    </template>
  </basic-menu>
</template>

<script>
import { mapGetters } from 'vuex'
import { mapFields } from 'vuex-map-fields'

export default {
  props: {
    iconColor: String
  },
  computed: {
    ...mapGetters([
      'selectedWorkspace'
    ]),
    ...mapFields({
      menus: 'menus',
      workspaces: 'storageData.workspaces',
      shortcuts: 'storageData.settings.shortcuts'
    })
  }
}
</script>
