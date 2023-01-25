<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'newDirItemDialog'}),
    }"
    :action-buttons="[
      {
        text: $t('cancel'),
        onClick: () => $store.dispatch('closeDialog', {name: 'newDirItemDialog'})
      },
      {
        text: $t('create'),
        disabled: !dialog.data.isValid,
        onClick: () => createDirItem()
      }
    ]"
    :title="`${$t('createNew')} ${dialog.data.type}`"
    height="unset"
  >
    <template #content>
      <div>
        <span style="font-weight: bold">{{$t('path')}}:</span>
        {{newDirItemPath}}
      </div>

      <!-- input::dir-item-name -->
      <v-text-field
        ref="newDirItemDialogNameInput"
        v-model="dialog.data.name"
        :label="`${$t('new')} ${dialog.data.type} ${$t('name')}`"
        :value="dialog.data.name"
        :error="!dialog.data.isValid"
        :hint="dialog.data.error"
        autofocus
        @input="validateNewDirItemInput()"
        @keypress.enter="createDirItem()"
      />
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'

const PATH = require('path')
const fs = require('fs')

export default {
  watch: {
    'dialog.value' (value) {
      if (value) {
        this.$nextTick(() => {
          this.$refs.newDirItemDialogNameInput.focus()
        })
      }
      else {
        this.$store.dispatch('resetDialogData', {name: 'newDirItemDialog'})
      }
    },
  },
  computed: {
    ...mapState({
      dialog: state => state.dialogs.newDirItemDialog,
      currentDir: state => state.navigatorView.currentDir,
    }),
    newDirItemPath () {
      return PATH.posix.join(this.currentDir.path, this.dialog.data.name)
    },
  },
  methods: {
    validateNewDirItemInput () {
      const newName = this.dialog.data.name
      const newPath = PATH.posix.join(this.currentDir.path, newName)
      const pathValidationData = this.$utils.isPathValid(newPath, {canBeRootDir: false})
      this.dialog.data.error = pathValidationData.error
      this.dialog.data.isValid = pathValidationData.isValid
    },
    createDirItem () {
      if (this.dialog.data.name === '') {return}
      const dir = this.currentDir.path
      const type = this.dialog.data.type
      const name = this.dialog.data.name
      const path = PATH.posix.join(dir, name)
      // Check if specified path already exists
      fs.promises.access(path, fs.constants.F_OK)
        .then(() => {
          // If path already exists
          this.$eventHub.$emit('notification', {
            action: 'add',
            timeout: 3000,
            closeButton: true,
            title: this.$t('errors.errorPathAlreadyExists'),
            message: path,
          })
        })
        .catch(() => {
          // If path doesn't exist, create it
          let promiseToCreateDirItem
          if (type === 'directory') {
            promiseToCreateDirItem = fs.promises.mkdir(path, {recursive: true})
          }
          else if (type === 'file') {
            promiseToCreateDirItem = fs.promises.writeFile(path, '')
          }
          promiseToCreateDirItem
            .then(() => {
              setTimeout(() => {
                this.$eventHub.$emit('notification', {
                  action: 'add',
                  timeout: 3000,
                  title: type === 'directory'
                    ? this.$t('dialogs.newDirItemDialog.newDirectoryCreated')
                    : this.$t('dialogs.newDirItemDialog.newFileCreated'),
                  message: path,
                })
              }, 1000)
              this.dialog.value = false
            })
            .catch((error) => {
              this.$eventHub.$emit('notification', {
                action: 'add',
                timeout: 5000,
                closeButton: true,
                title: type === 'directory'
                  ? this.$t('dialogs.newDirItemDialog.failedToCreateNewDirectory')
                  : this.$t('dialogs.newDirItemDialog.failedToCreateNewFile'),
                message: `${this.$t('errors.error')}: ${error}`,
              })
            })
        })
    },
  },
}
</script>

<style scoped>

</style>