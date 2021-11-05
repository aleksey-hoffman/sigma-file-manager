<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <basic-menu
    v-model="menus.workspaces"
    :menuButton="{
      tooltip: {
        description: 'Workspaces',
        shortcut: shortcuts.switchWorkspace.shortcut
      }
    }"
    :header="{
      title: 'Workspaces',
      buttons: [
        {
          icon: {
            name: 'mdi-plus',
            size: '24px'
          },
          tooltip: {
            description: 'New workspace'
          },
          onClick: () => $store.state.dialogs.workspaceEditorDialog.value = true
        },
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
    <template v-slot:activator>
      <button class="window-toolbar__item button--menu"
      >
        <v-icon
          :color="iconColor"
          size="18px"
        >mdi-vector-arrange-below
        </v-icon>

        <div 
          class="button--menu__counter" 
          :style="{color: iconColor}"
        >
          {{workspaceButtonText}}
        </div>
      </button>
    </template>
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
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'

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
    }),
    workspaceButtonText () {
      return this.workspaces.items.find(workspace => workspace.isSelected).id + 1
    }
  }
}
</script>
