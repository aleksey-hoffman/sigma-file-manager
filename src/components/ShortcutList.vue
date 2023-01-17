<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <div class="text--sub-title-1 mb-0">
      {{$t('shortcutsUI.globalShortcutsSystemScope')}}
    </div>
    <div class="mt-2 mb-4 settings-card__description">
      {{$t('shortcutsUI.globalShortcutsTriggerActionsWhenNotFocused')}}
    </div>
    <div
      v-for="(shortcut, index) in globalShortcutsList"
      :key="'shortcut-' + index"
      class="shortcut-list__item"
    >
      <v-icon :size="shortcut.iconSize || '22px'">
        {{shortcut.icon}}
      </v-icon>
      <div class="shortcut-list__item-description">
        {{shortcut.description}}
      </div>
      <div class="shortcut-list__item-shortcut">
        {{shortcutFiltered(shortcut.shortcut)}}
      </div>
      <div class="shortcut-list__item-actions">
        <v-menu offset-y>
          <template #activator="{ on, attrs }">
            <v-btn
              v-bind="attrs"
              icon
              v-on="on"
            >
              <v-icon size="20px">
                mdi-dots-vertical
              </v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-item
              @click="
                dialogs.shortcutEditorDialog.data.shortcut = shortcut.shortcut,
                dialogs.shortcutEditorDialog.data.shortcutName = index,
                dialogs.shortcutEditorDialog.value = true
              "
            >
              <v-list-item-action>
                <v-icon size="20px">
                  mdi-pencil-outline
                </v-icon>
              </v-list-item-action>
              <v-list-item-title>
                {{$t('shortcutsUI.changeShortcut')}}
              </v-list-item-title>
            </v-list-item>
            <v-list-item
              @click="$store.dispatch('RESET_SHORTCUT', index)"
            >
              <v-list-item-action>
                <v-icon size="20px">
                  mdi-backup-restore
                </v-icon>
              </v-list-item-action>
              <v-list-item-title>
                {{$t('shortcutsUI.resetShortcut')}}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </div>

    <div class="text--sub-title-1 mt-6 mb-0">
      {{$t('shortcutsUI.localShortcutsAppScope')}}
    </div>
    <div class="pb-2">
      <div
        v-for="(shortcut, index) in localShortcutsList"
        :key="'shortcut-' + index"
      >
        <div
          v-if="shortcutFiltered(shortcut.shortcut)"
          class="shortcut-list__item"
        >
          <v-icon :size="shortcut.iconSize || '22px'">
            {{shortcut.icon}}
          </v-icon>
          <div class="shortcut-list__item-description">
            {{shortcut.description}}
          </div>
          <div class="shortcut-list__item-shortcut">
            {{shortcutFiltered(shortcut.shortcut)}}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'

export default {
  computed: {
    ...mapFields({
      shortcuts: 'storageData.settings.shortcuts',
      dialogs: 'dialogs',
    }),
    ...mapGetters([
      'systemInfo',
    ]),
    globalShortcutsList () {
      return this.$utils.filterObject(
        this.shortcuts,
        ([key, value]) => value.isGlobal,
      )
    },
    localShortcutsList () {
      return this.$utils.filterObject(
        this.shortcuts,
        ([key, value]) => !value.isGlobal,
      )
    },
  },
  methods: {
    shortcutFiltered (shortcut) {
      if (typeof shortcut === 'string') {return shortcut}
      else {return shortcut[this.systemInfo.platform]}
    },
  },
}
</script>

<style>
.shortcut-list__item
  .v-icon {
    color: var(--color-6) !important;
  }

.shortcut-list__item {
  display: grid;
  grid-template-columns: 16px 1fr 0.5fr 32px;
  min-height: 32px;
  padding: 8px 0px;
  gap: 24px;
  align-items: center;
  border-bottom: 1px solid var(--divider-color-1);
}

.shortcut-list__item-shortcut {
  border-left: 1px solid var(--divider-color-1);
  padding: 8px;
  font-size: 14px;
}
</style>