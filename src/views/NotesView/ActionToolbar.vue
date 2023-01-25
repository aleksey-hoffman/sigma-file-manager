<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <ActionToolbarBase>
    <!-- button::new-note -->
    <AppButton
      icon="mdi-plus"
      icon-size="22px"
      icon-class="action-toolbar__icon"
      :tooltip="$t('notes.newNote')"
      @click="$store.dispatch('openNoteEditor', {type: 'new'})"
    />

    <!-- button-toggle::notes -->
    <VBtnToggle
      v-model="currentNotesList"
      class="dir-item-layout-toggle"
      dense
      mandatory
    >
      <!-- button-toggle::existing-notes -->
      <AppButton
        button-class="action-toolbar__item action-toolbar__button-toggle"
        icon="mdi-square-edit-outline"
        icon-size="20px"
        icon-class="action-toolbar__icon"
        value="existing"
        :tooltip="$t('notes.existingNotes')"
        small
        @click="$store.dispatch('SET', {key: 'currentNotesList', value: 'existing'})"
      />

      <!-- button-toggle::trashed-notes -->
      <AppButton
        button-class="action-toolbar__item action-toolbar__button-toggle"
        icon="mdi-trash-can-outline"
        icon-size="20px"
        icon-class="action-toolbar__icon"
        value="trashed"
        :tooltip="$t('notes.trashedNotes')"
        small
        @click="$store.dispatch('SET', {key: 'currentNotesList', value: 'trashed'})"
      />
    </VBtnToggle>
  </ActionToolbarBase>
</template>

<script>
import {mapActions} from 'vuex'
import {mapFields} from 'vuex-map-fields'
import ActionToolbarBase from '@/components/ActionToolbarBase/ActionToolbarBase.vue'
import AppButton from '@/components/AppButton/AppButton.vue'

export default {
  components: {
    ActionToolbarBase,
    AppButton,
  },
  computed: {
    ...mapFields({
      currentNotesList: 'currentNotesList',
    }),
  },
  methods: {
    ...mapActions([
      'openNoteEditorDialog',
    ]),
  },
}
</script>
