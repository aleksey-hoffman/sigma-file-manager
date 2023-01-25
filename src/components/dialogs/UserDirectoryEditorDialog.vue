<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'userDirectoryEditorDialog'}),
    }"
    :title="$t('dialogs.userDirectoryEditorDialog.userDirectoryEditor')"
    height="unset"
    fade-mask-bottom="0%"
  >
    <template #content>
      <v-text-field
        v-model="dialog.data.item.title"
        :label="$t('dialogs.userDirectoryEditorDialog.directoryTitle')"
        autofocus
      />

      <v-text-field
        v-model="dialog.data.item.path"
        :label="$t('dialogs.userDirectoryEditorDialog.directoryPath')"
        :hint="pathIsValid.error"
        :error="!pathIsValid.value"
        :persistent-hint="!pathIsValid.value"
      />

      <v-layout align-center>
        <v-text-field
          v-model="dialog.data.item.icon"
          :label="$t('dialogs.userDirectoryEditorDialog.iconName')"
        />

        <v-tooltip bottom>
          <template #activator="{ on }">
            <v-btn
              class="button-1 ml-2"
              depressed
              small
              v-on="on"
              @click="$utils.openLink(materialdesigniconsLink)"
            >
              {{$t('dialogs.userDirectoryEditorDialog.openIconList')}}
            </v-btn>
          </template>
          <span>
            <v-layout align-center>
              <v-icon
                class="mr-3"
                size="16px"
              >
                mdi-open-in-new
              </v-icon>
              {{materialdesigniconsLink}}
            </v-layout>
          </span>
        </v-tooltip>
      </v-layout>

      <v-layout align-center>
        <div class="mr-2">
          {{$t('dialogs.userDirectoryEditorDialog.iconPreview')}}:
        </div>
        <v-icon>{{dialog.data.item.icon}}</v-icon>
      </v-layout>
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'

const fs = require('fs')

export default {
  data () {
    return {
      materialdesigniconsLink: 'https://materialdesignicons.com/',
    }
  },
  watch: {
    'dialog.value' (value) {
      this.handleDialogValueChange(value)
    },
    'dialog.data': {
      handler () {
        this.handleDialogDataChange()
      },
      deep: true,
    },
  },
  computed: {
    ...mapState({
      dialog: state => state.dialogs.userDirectoryEditorDialog,
    }),
    dialogIsValid () {
      return this.pathIsValid.value
    },
    pathIsValid () {
      if (!this.dialog?.data?.item?.path) {return false}
      const path = this.dialog.data.item.path
      const pathIsEmpty = path?.length === 0
      const pathExists = !pathIsEmpty && fs.existsSync(path)
      if (pathIsEmpty) {
        return {
          value: false,
          error: this.$t('dialogs.userDirectoryEditorDialog.pathCannotBeEmpty'),
        }
      }
      if (!pathExists) {
        return {
          value: false,
          error: this.$t('dialogs.userDirectoryEditorDialog.pathDoesNotExist'),
        }
      }
      else {
        return {
          value: true,
          error: '',
        }
      }
    },
  },
  methods: {
    handleDialogDataChange () {
      if (this.dialogIsValid) {
        this.dialog.dataIsValid = true
        this.$store.dispatch('SET', {
          key: 'storageData.settings.appPaths.userDirs',
          value: this.dialog.data.userDirs,
        })
      }
      else {
        this.dialog.dataIsValid = false
      }
    },
    handleDialogValueChange (dialogValue) {
      if (dialogValue) {
        this.$nextTick(() => {
          this.dialog.initialData = this.$utils.cloneDeep(this.dialog.data)
        })
      }
      else if (!dialogValue) {
        if (!this.dialog.dataIsValid) {
          this.dialog.data = this.$utils.cloneDeep(this.dialog.initialData)
          this.dialog.dataIsValid = true
        }
      }
    },
  },
}
</script>

<style scoped>

</style>