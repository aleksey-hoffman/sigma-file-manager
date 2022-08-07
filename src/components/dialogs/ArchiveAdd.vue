<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => closeDialog()
    }"
    :action-buttons="[
      {
        text: 'cancel',
        onClick: () => closeDialog()
      },
      {
        text: 'create archive',
        disabled: !dialog.data.isValid,
        onClick: () => initCreateArchive()
      }
    ]"
    title="Archive selected items"
    height="unset"
    fade-mask-bottom="0%"
  >
    <template #content>
      <v-select
        v-model="dialog.data.selectedFormat"
        label="Archive format"
        :items="dialog.data.formats"
      />

      <v-text-field
        v-model="dialog.data.dest.path"
        label="Destination path"
        :value="dialog.data.dest.path"
        :error="!dialog.data.isValid"
        :hint="dialog.data.error"
        :persistent-hint="!dialog.data.isValid"
        autofocus
        @input="validateArchivePath()"
        @keypress.enter="initCreateArchive()"
      />

      <v-select
        v-model="dialog.data.compression"
        label="Compression"
        item-text="title"
        return-object
        :items="dialog.data.compressionOptions"
      />

      <v-checkbox
        v-model="dialog.data.setPassword"
        label="Encrypt with password"
        dense
        hide-details
      />

      <v-text-field
        v-if="dialog.data.setPassword"
        ref="archiveDialogPasswordInput"
        v-model="dialog.data.options.password"
        label="Password"
        @keypress.enter="initCreateArchive()"
      />

      <v-checkbox
        v-model="dialog.data.options.deleteFilesAfter"
        label="Delete files after"
        dense
        hide-details
      />

      <div class="mt-4">
        <div class="dialog__prop-list-item">
          <div class="dialog__prop-list-item-title">
            Items to add:
          </div>
          <div class="dialog__prop-list-item-description">
            {{targetItems.length}}
          </div>
        </div>
      </div>
    </template>
  </dialog-generator>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

const PATH = require('path')

export default {
  watch: {
    'dialog.value' (value) {
      if (value) {
        this.setArchivePath()
      }
      else if (!value) {
        this.dialog = this.defaultData.dialogs.archiveAdd
      }
    },
    'dialog.data.selectedFormat' () {
      this.setArchivePath()
    },
    'dialog.data.setPassword' (value) {
      if (value) {
        this.$nextTick(() => {
          this.$refs.archiveDialogPasswordInput?.focus()
        })
      }
    },
  },
  computed: {
    ...mapFields({
      defaultData: 'defaultData',
      dialog: 'dialogs.archiveAdd',
      targetItems: 'contextMenus.dirItem.targetItems',
      targetItemsStats: 'contextMenus.dirItem.targetItemsStats',
    }),
  },
  methods: {
    closeDialog () {
      this.dialog.value = false
    },
    validations () {
      return {
        archiveName: this.validateArchivePath(),
      }
    },
    validateArchivePath () {
      if (this.dialog.data.dest.name === '') {
        this.dialog.data.error = 'Name cannot be empty'
        this.dialog.data.isValid = false
        return
      }
      const pathValidationData = this.$utils.isPathValid(this.dialog.data.dest.path)
      this.dialog.data.error = pathValidationData.error
      this.dialog.data.isValid = pathValidationData.isValid
    },
    initCreateArchive () {
      if (!this.dialog.data.isValid) {return}
      this.processParams()
      this.$store.dispatch('addToArchive', {
        sourcePath: this.targetItemsStats.dirItemsPaths[0],
        destPath: this.dialog.data.dest.path,
        options: this.dialog.data.options,
      })
      this.closeDialog()
    },
    processParams () {
      const pathEndsWithExt = this.dialog.data.dest.path.endsWith(`.${this.dialog.data.selectedFormat}`)
      if (!pathEndsWithExt) {
        this.dialog.data.dest.path = `${this.dialog.data.dest.path}.${this.dialog.data.selectedFormat}`
      }
      this.dialog.data.options.method = [
        this.dialog.data.compression.value,
      ]
      // module cannot handle falsy values
      if (!(this.dialog.data.setPassword && this.dialog.data.options.password.length > 0)) {
        delete this.dialog.data.options.password
      }
    },
    setArchivePath () {
      const name = this.dialog.data.dest.name
      const destDir = this.dialog.data.dest.dir
      const formatExt = this.dialog.data.selectedFormat
      this.dialog.data.dest.path = PATH.join(destDir, `${name}.${formatExt}`)
    },
  },
}
</script>

<style>
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