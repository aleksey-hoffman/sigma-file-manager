<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'renameDirItemDialog'}),
    }"
    :action-buttons="[
      {
        text: $t('cancel'),
        onClick: () => $store.dispatch('closeDialog', {name: 'renameDirItemDialog'})
      },
      {
        text: $t('save'),
        disabled: !dialog.data.isValid,
        onClick: () => initDirItemRename()
      }
    ]"
    :title="$t('dialogs.renameDirItemDialog.renameItem')"
    height="unset"
  >
    <template #content>
      <div>
        <span style="font-weight: bold">{{$t('dialogs.renameDirItemDialog.currentName')}}:</span>
        {{editTargets[0].name}}
      </div>

      <!-- input::dir-item-new-name -->
      <v-text-field
        id="renameItemDialogNameInput"
        ref="renameItemDialogNameInput"
        v-model="dialog.data.name"
        :label="$t('dialogs.renameDirItemDialog.newName')"
        :value="dialog.data.name"
        :error="!dialog.data.isValid"
        :hint="dialog.data.error"
        autofocus
        @input="validateName()"
        @keypress.enter="initDirItemRename()"
      />
    </template>
  </dialog-generator>
</template>

<script>
import {mapGetters, mapState} from 'vuex'

const fs = require('fs')
const PATH = require('path')

export default {
  data () {
    return {
      editTargets: [],
    }
  },
  watch: {
    'dialog.value' (value) {
      if (value) {
        this.editTargets = [this.$utils.cloneDeep(this.selectedDirItems.at(-1))]
        this.dialog.data.name = this.editTargets[0].name
        const parsedName = PATH.parse(this.dialog.data.name)
        const isDir = fs.statSync(this.editTargets[0].path).isDirectory()
        // Focus input field
        this.$nextTick(() => {
          this.$refs.renameItemDialogNameInput.focus()
          // Set selection range for the name (exclude file extension)
          this.$refs.renameItemDialogNameInput.$refs.input.setSelectionRange(
            0,
            // Select the whole directory name to avoid partial selection of dir names containing dots
            isDir ? parsedName.base.length : parsedName.name.length,
          )
        })
      }
      else {
        this.$store.dispatch('resetDialogData', {name: 'renameDirItemDialog'})
      }
    },
  },
  computed: {
    ...mapGetters([
      'selectedDirItems',
    ]),
    ...mapState({
      dialog: state => state.dialogs.renameDirItemDialog,
    }),
  },
  methods: {
    initDirItemRename () {
      if (!this.dialog.data.isValid) {return}
      const dir = PATH.parse(this.editTargets[0].path).dir
      const newName = this.dialog.data.name
      const oldName = this.editTargets[0].name
      const oldPath = PATH.posix.join(dir, oldName)
      const newPath = PATH.posix.join(dir, newName)
      this.$store.dispatch('RENAME_DIR_ITEM', {
        oldPath,
        newPath,
        newName,
        oldName,
      })
    },
    validateName () {
      const parsedItemPath = PATH.parse(this.editTargets[0].path)
      const newName = this.dialog.data.name
      const newPath = `${parsedItemPath.dir}/${newName}`
      const pathValidationData = this.$utils.isPathValid(newPath, {canBeRootDir: false, operation: 'rename'})
      this.dialog.data.error = pathValidationData.error
      this.dialog.data.isValid = pathValidationData.isValid
    },
  },
}
</script>

<style scoped>

</style>