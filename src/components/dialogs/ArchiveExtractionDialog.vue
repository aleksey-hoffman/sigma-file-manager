<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'archiveExtract'})
    }"
    :action-buttons="[
      {
        text: $t('cancel'),
        onClick: () => $store.dispatch('closeDialog', {name: 'archiveExtract'})
      },
      {
        text: $t('dialogs.archiveExtractionDialog.extractArchive'),
        disabled: !dialog.data.isValid,
        onClick: () => initExtractArchive()
      }
    ]"
    :title="$t('dialogs.archiveExtractionDialog.extractArchive')"
    height="unset"
    fade-mask-bottom="0%"
  >
    <template #content>
      <v-text-field
        v-if="dialog.data.isEncrypted"
        ref="archiveExtractDialogPasswordInput"
        v-model="dialog.data.password"
        :error="!validations.archivePassword.isValid"
        autofocus
        :label="$t('password')"
        @keypress.enter="initExtractArchive()"
      />

      <v-text-field
        ref="archiveExtractDialogDestPathInput"
        v-model="dialog.data.destPath"
        autofocus
        :label="$t('dialogs.archiveExtractionDialog.destinationPath')"
        @keypress.enter="initExtractArchive()"
      />

      <div
        v-if="dialog.data.isGettingStats"
        class="dialog__prop-list-loader"
      >
        <v-progress-circular
          indeterminate
          size="18"
          width="2"
          color="primary"
          class="mr-3"
        />
        {{$t('dialogs.archiveExtractionDialog.gettingStats')}}
      </div>
      <div
        v-else
        class="dialog__prop-list"
      >
        <div
          v-for="(property, key) in dialog.data.archiveData"
          :key="key"
          class="dialog__prop-list-item"
        >
          <div class="dialog__prop-list-item-title">
            {{dialog.data.archiveData[key].title}}
          </div>
          <div class="dialog__prop-list-item-description">
            {{dialog.data.archiveData[key].readableValue}}
          </div>
        </div>
      </div>
    </template>
  </dialog-generator>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  watch: {
    'dialog.value' (value) {
      if (!value) {
        this.dialog = this.defaultData.dialogs.archiveExtract
      }
    },
  },
  computed: {
    ...mapFields({
      defaultData: 'defaultData',
      dialog: 'dialogs.archiveExtract',
      targetItems: 'contextMenus.dirItem.targetItems',
      targetItemsStats: 'contextMenus.dirItem.targetItemsStats.dirItemsPaths',
    }),
    validations () {
      return {
        archivePassword: this.validateArchivePassword(),
      }
    },
  },
  methods: {
    validateArchivePassword () {
      if (this.dialog.data.isEncrypted && this.dialog.data.password === '') {
        this.dialog.data.error = this.$t('enterPassword')
        this.dialog.data.isValid = false
      }
      else {
        this.dialog.data.error = ''
        this.dialog.data.isValid = true
      }
      return {
        error: this.dialog.data.error,
        isValid: this.dialog.data.isValid,
      }
    },
    initExtractArchive () {
      if (!this.dialog.data.isValid) {return}
      this.dialog.data.onExtract()
    },
  },
}
</script>

<style>
.dialog__prop-list-loader {
  display: flex;
  align-items: center;
}

.dialog__prop-list-item {
  display: flex;
  align-items: center;
}

.dialog__prop-list-item-title {
  margin-right: 8px;
  color: var(--color-6);
  font-size: 12px;
  text-transform: uppercase;
}

.dialog__prop-list-item-description {
  color: var(--color-7);
  font-size: 14px;
}
</style>