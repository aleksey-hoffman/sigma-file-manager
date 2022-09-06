<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <ActionToolbarBase>
    <!-- button::new-dir-item -->
    <AppMenuButton
      button-class="action-toolbar__item"
      icon="mdi-plus"
      icon-size="22px"
      icon-class="action-toolbar__icon"
      tooltip="New directory / file"
      :menu-items="newDirItemMenuItems"
      :menu-item-attributes="{'two-line': true, dense: true}"
    />
    <!-- button::sorting-menu -->
    <SortingMenu v-if="navigatorSortingElementDisplayType === 'icon'">
      <template #activator="{menuActivatorOnProp}">
        <v-btn
          class="action-toolbar__item"
          icon
          v-on="menuActivatorOnProp"
        >
          <v-icon size="18px">
            mdi-sort
          </v-icon>
        </v-btn>
      </template>
    </SortingMenu>
    <!-- TODO: finish in v1.1.0
      - Curently dir item range selection doesn't work properly
        because grouping changes dir item indexes
    -->
    <!-- button::file-grouping -->
    <!-- <AppButton
      button-class="action-toolbar__item"
      icon="mdi-view-agenda-outline"
      icon-size="20px"
      :icon-class="{
        'action-toolbar__icon': !groupDirItems,
        'action-toolbar__icon--active': groupDirItems
      }"
      :tooltip="`Group files by type | ${groupDirItems ? 'ON' : 'OFF'}`"
      @click="groupDirItems = !groupDirItems"
    /> -->
    <!-- button-toggle::navigator-layout -->
    <VBtnToggle
      v-model="navigatorLayout"
      class="dir-item-layout-toggle"
      dense
      mandatory
    >
      <AppButton
        button-class="action-toolbar__item action-toolbar__button-toggle"
        icon="mdi-view-list"
        icon-size="20px"
        icon-class="action-toolbar__icon"
        value="list"
        tooltip="List layout"
        small
      />
      <AppButton
        button-class="action-toolbar__item action-toolbar__button-toggle"
        icon="mdi-view-module"
        icon-size="20px"
        icon-class="action-toolbar__icon"
        value="grid"
        tooltip="Grid layout"
        small
      />
    </VBtnToggle>

    <VDivider
      class="action-toolbar__divider mx-2"
      vertical
    />

    <VSpacer />

    <VDivider
      class="action-toolbar__divider mx-2"
      vertical
    />

    <!-- button::info-panel -->
    <AppButton
      button-class="action-toolbar__item"
      icon="mdi-dock-right"
      icon-size="18px"
      icon-class="action-toolbar__icon"
      tooltip="Toggle info panel"
      @click="toggleInfoPanel()"
    />
  </ActionToolbarBase>
</template>

<script>
import {mapActions} from 'vuex'
import {mapFields} from 'vuex-map-fields'
import ActionToolbarBase from '@/components/ActionToolbarBase/ActionToolbarBase.vue'
import SortingMenu from '@/components/SortingToolbar/SortingMenu.vue'
import AppButton from '@/components/AppButton/AppButton.vue'
import AppMenuButton from '@/components/AppMenuButton/AppMenuButton.vue'

export default {
  components: {
    ActionToolbarBase,
    SortingMenu,
    AppButton,
    AppMenuButton,
  },
  computed: {
    ...mapFields({
      shortcuts: 'storageData.settings.shortcuts',
      navigatorViewInfoPanel: 'storageData.settings.infoPanels.navigatorView',
      navigatorSortingElementDisplayType: 'storageData.settings.navigator.sorting.elementDisplayType',
      groupDirItems: 'storageData.settings.groupDirItems',
    }),
    newDirItemMenuItems () {
      return [
        {
          title: 'New directory',
          subtitle: this.shortcuts.newDirectory.shortcut,
          icon: 'mdi-folder-plus-outline',
          type: 'directory',
          shortcut: 'newDirectory',
          onClick: () => {
            this.showNewDirItemDialog('directory')
          },
        },
        {
          title: 'New file',
          subtitle: this.shortcuts.newFile.shortcut,
          icon: 'mdi-file-plus-outline',
          type: 'file',
          shortcut: 'newFile',
          onClick: () => {
            this.showNewDirItemDialog('file')
          },
        },
      ]
    },
    navigatorLayout: {
      get () {
        return this.$store.state.storageData.settings.navigatorLayout
      },
      set (value) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.navigatorLayout',
          value,
        })
        // Reload dir to update item 'height' property
        this.$store.dispatch('LOAD_DIR', {
          path: this.currentDir.path,
          scrollTop: false,
        })
      },
    },
  },
  methods: {
    ...mapActions([
      'showNewDirItemDialog',
    ]),
    toggleInfoPanel () {
      if (this.$route.name === 'navigator') {
        let appLayoutElement = document.querySelector('#app')
        appLayoutElement.setAttribute('preserve-transition', true)
        setTimeout(() => {
          appLayoutElement.removeAttribute('preserve-transition')
        }, 500)
        this.navigatorViewInfoPanel.value = !this.navigatorViewInfoPanel.value
      }
    },
  },
}
</script>
