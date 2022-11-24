<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <basic-menu
    v-model="menus.tabs"
    :menu-button="{
      tooltip: {
        description: $t('tabs.workspaceTabs'),
        shortcut: shortcuts.switchTab.shortcut
      }
    }"
    :header="{
      title: $t('tabs.workspaceTabs'),
      buttons: [
        {
          icon: {
            name: 'mdi-plus',
            size: '24px'
          },
          tooltip: {
            description: $t('tabs.newTabInCurrentWorkspace')
          },
          ifCondition: $route.name === 'navigator',
          onClick: () => $store.dispatch('ADD_TAB')
        },
        {
          icon: {
            name: 'mdi-close-box-multiple-outline',
            size: '20px'
          },
          tooltip: {
            description: $t('tabs.closeAllTabsInCurrentWorkspace')
          },
          onClick: () => $store.dispatch('CLOSE_ALL_TABS_IN_CURRENT_WORKSPACE')
        }
      ]
    }"
  >
    <template #activator>
      <button class="window-toolbar__item button--menu">
        <v-icon
          :color="iconColor"
          size="18px"
        >
          mdi-tab
        </v-icon>

        <div
          class="button--menu__counter"
          :style="{color: iconColor}"
        >
          {{tabsButtonText}}
        </div>
      </button>
    </template>
    <template #content>
      <sortable-list
        source="tabs"
        item-name="tab"
        :no-data="$t('tabs.noTabsInCurrentWorkspace')"
      />
    </template>
  </basic-menu>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'

export default {
  props: {
    iconColor: {
      type: String,
      default: '#fff',
    },
  },
  computed: {
    ...mapFields({
      menus: 'menus',
      shortcuts: 'storageData.settings.shortcuts',
    }),
    ...mapGetters([
      'selectedWorkspace',
    ]),
    tabsButtonText () {
      let tabIndex = this.selectedWorkspace.tabs.findIndex(tab => {
        return tab.path === this.$store.state.navigatorView.currentDir.path
      }) + 1 || '-'
      return tabIndex
    },
  },
}
</script>
