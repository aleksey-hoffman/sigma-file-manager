<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <basic-menu
    v-model="menus.workspaces"
    :menu-button="{
      tooltip: {
        description: $t('workspaces.title'),
        shortcut: shortcuts.switchWorkspace.shortcut
      }
    }"
    :header="{
      title: $t('workspaces.title'),
      buttons: headerButtons
    }"
  >
    <template #activator>
      <button
        class="window-toolbar__item button--menu"
      >
        <v-icon
          :color="iconColor"
          size="18px"
        >
          mdi-vector-arrange-below
        </v-icon>

        <div
          class="button--menu__counter"
          :style="{color: iconColor}"
        >
          {{workspaceButtonText}}
        </div>
      </button>
    </template>
    <template #content>
      <sortable-list
        source="workspaces"
        item-name="workspace"
      />
    </template>
  </basic-menu>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'

export default {
  props: {
    iconColor: String,
  },
  computed: {
    ...mapGetters([
      'selectedWorkspace',
    ]),
    ...mapFields({
      menus: 'menus',
      workspaces: 'storageData.workspaces',
      shortcuts: 'storageData.settings.shortcuts',
      showTitleInToolbar: 'storageData.settings.navigator.workspaces.showTitleInToolbar',
    }),
    headerButtons () {
      return [
        {
          icon: {
            name: 'mdi-pencil-outline',
            size: '20px',
          },
          tooltip: {
            description: this.$t('workspaces.editWorkspaces'),
          },
          onClick: () => {
            this.$store.state.dialogs.workspaceEditor.value = true
          },
        },
      ]
    },
    workspaceButtonText () {
      if (this.showTitleInToolbar) {
        return this.workspaces.items.find(workspace => workspace.isSelected).name
      }
      else {
        return this.workspaces.items.find(workspace => workspace.isSelected).id + 1
      }
    },
  },
}
</script>
