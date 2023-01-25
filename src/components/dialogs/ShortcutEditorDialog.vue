<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'shortcutEditorDialog'}),
    }"
    :action-buttons="[
      {
        text: $t('cancel'),
        onClick: () => $store.dispatch('closeDialog', {name: 'shortcutEditorDialog'})
      },
      {
        text: $t('dialogs.shortcutEditorDialog.changeShortcut'),
        disabled: !dialog.data.isValid,
        onClick: () => {
          $store.dispatch('SET_SHORTCUT', {
            shortcutName: dialog.data.shortcutName,
            shortcut: dialog.data.shortcut
          })
            .then(() => {
              dialog.value = false
            })
        }
      }
    ]"
    :title="$t('dialogs.shortcutEditorDialog.shortcutEditor')"
    max-width="500px"
  >
    <template #content>
      <v-tooltip
        bottom
        open-delay="200"
        max-width="300px"
      >
        <template #activator="{ on }">
          <div v-on="on">
            <v-text-field
              v-model="dialog.data.shortcut"
              :error="!dialog.data.isValid"
              :hint="dialog.data.error"
              :placeholder="$t('dialogs.shortcutEditorDialog.shortcut')"
              @keydown="$store.dispatch('SET_SHORTCUT_KEYDOWN_HANDLER', {
                event: $event,
                shortcut: dialog.data.shortcut,
                shortcutName: dialog.data.shortcutName
              })"
            />
          </div>
        </template>
        <span>
          <div>
            {{$t('dialogs.shortcutEditorDialog.shortcutIsACombination')}}
            <li>{{$t('dialogs.shortcutEditorDialog.modifierKeys')}}</li>
            <li>{{$t('dialogs.shortcutEditorDialog.regularKey')}}</li>
          </div>

          <div class="mt-2">
            {{$t('dialogs.shortcutEditorDialog.examples')}}:
            <li>{{$t('dialogs.shortcutEditorDialog.ctrlShiftSpace')}}</li>
            <li>{{$t('dialogs.shortcutEditorDialog.ctrlF1')}}</li>
            <li>{{$t('dialogs.shortcutEditorDialog.metaEsc')}}</li>
          </div>
        </span>
      </v-tooltip>
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'

export default {
  computed: {
    ...mapState({
      dialog: state => state.dialogs.shortcutEditorDialog,
    }),
  },
}
</script>

<style scoped>

</style>