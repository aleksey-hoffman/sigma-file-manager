<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'programEditorDialog'}),
    }"
    :action-buttons="[
      {
        text: $t('cancel'),
        onClick: () => $store.dispatch('closeDialog', {name: 'programEditorDialog'})
      },
      {
        text: dialog.data.selectedProgram.isTemplate
          ? $t('dialogs.programEditorDialog.addProgram')
          : $t('dialogs.programEditorDialog.saveProgram'),
        disabled: !dialogIsValid,
        onClick: () => saveProgramChanges()
      }
    ]"
    :title="$t('dialogs.programEditorDialog.externalProgramEditor')"
    height="90vh"
    max-width="600px"
  >
    <template #content>
      <div class="text--sub-title-1 mb-2">
        {{$t('dialogs.programEditorDialog.chooseProgram')}}
      </div>

      <!-- program-list -->
      <v-layout align-center>
        <v-select
          v-model="dialog.data.selectedProgram"
          :items="filteredPrograms"
          class="mr-4"
          item-text="name"
          :label="$t('dialogs.programEditorDialog.program')"
          return-object
          @input="programInputHandler"
        >
          <!-- program::icon:add/edit -->
          <template #selection="{ item }">
            <v-icon
              size="20px"
              class="mr-2"
            >
              {{addEditIcon(item)}}
            </v-icon>
            <span>{{item.name}}</span>
          </template>
          <template #item="{ item }">
            <v-icon
              size="20px"
              class="mr-2"
            >
              {{addEditIcon(item)}}
            </v-icon>
            <span>{{addEditDescription(item)}}</span>
          </template>
        </v-select>

        <!-- program::icon:trash -->
        <v-tooltip bottom>
          <template #activator="{ on }">
            <v-btn
              :disabled="dialog.data.selectedProgram.isTemplate"
              icon
              v-on="on"
              @click="deleteProgram()"
            >
              <v-icon
                size="16px"
              >
                mdi-trash-can-outline
              </v-icon>
            </v-btn>
          </template>
          <span>{{$t('dialogs.programEditorDialog.removeProgramFromTheList')}}</span>
        </v-tooltip>
      </v-layout>

      <!-- program::path -->
      <v-layout align-center>
        <v-text-field
          v-model="dialog.data.selectedProgram.path"
          :label="$t('dialogs.programEditorDialog.programPath')"
          :error="!programPathIsValid.value"
          :hint="programPathIsValid.error"
          class="mr-4"
          @input="onInputProgramPath"
        />

        <!-- program::icon:picker -->
        <v-tooltip bottom>
          <template #activator="{ on }">
            <v-btn
              icon
              v-on="on"
              @click="onClickPickProgram()"
            >
              <v-icon
                size="16px"
              >
                mdi-eyedropper
              </v-icon>
            </v-btn>
          </template>
          <span>{{$t('dialogs.programEditorDialog.pickAProgram')}}</span>
        </v-tooltip>
      </v-layout>

      <!-- program::name -->
      <v-text-field
        v-model="dialog.data.selectedProgram.name"
        :label="$t('dialogs.programEditorDialog.programName')"
        :error="!programNameIsValid.value"
        :hint="programNameIsValid.error"
      />

      <div class="text--sub-title-1 mb-2">
        {{$t('dialogs.programEditorDialog.programProperties')}}
      </div>

      <!-- program-property::can-open-directories -->
      <v-checkbox
        v-model="dialog.data.selectedProgram.targetTypes"
        value="directory"
        :label="$t('dialogs.programEditorDialog.programCanOpenDirectories')"
        class="mt-0"
        hide-details
      />

      <!-- program-property::can-open-files -->
      <v-checkbox
        v-model="dialog.data.selectedProgram.targetTypes"
        value="file"
        :label="$t('dialogs.programEditorDialog.programCanOpenFiles')"
        class="mt-2"
        hide-details
      />

      <v-expand-transition>
        <div v-show="dialog.data.selectedProgram.targetTypes.includes('file')">
          <v-combobox
            v-model="dialog.data.selectedProgram.selectedAllowedFileTypes"
            :items="dialog.data.allowedFileTypes"
            :label="$t('dialogs.programEditorDialog.allowedFileTypesExtensions')"
            class="mt-6"
            multiple
            hide-details
          />

          <v-combobox
            v-model="dialog.data.selectedProgram.selectedDisallowedFileTypes"
            :items="dialog.data.disallowedFileTypes"
            :label="$t('dialogs.programEditorDialog.disallowedFileTypesExtensions')"
            class="mt-6"
            multiple
            hide-details
          />
        </div>
      </v-expand-transition>

      <div class="text--sub-title-1 mt-4 mb-4">
        {{$t('dialogs.programEditorDialog.programIcon')}}
      </div>

      <!-- program::icon -->
      <div class="program-icon-set__container">
        <v-btn
          v-for="(icon, index) in externalPrograms.icons"
          :key="'icon-' + index"
          :is-selected="icon === dialog.data.selectedProgram.icon"
          icon
          @click="dialog.data.selectedProgram.icon = icon"
        >
          <v-icon size="22px">
            {{icon}}
          </v-icon>
        </v-btn>
      </div>
    </template>
  </dialog-generator>
</template>

<script>
import {mapGetters, mapState} from 'vuex'

const fs = require('fs')
const PATH = require('path')
const electronRemote = require('@electron/remote')
const currentWindow = electronRemote.getCurrentWindow()

export default {
  watch: {
    'dialog.value' (value) {
      if (value) {
        // Add program template to the selection list
        const programTemplate = this.$utils.cloneDeep(this.externalPrograms.programTemplate)
        programTemplate.isTemplate = true
        const items = [
          ...[programTemplate],
          ...this.$utils.cloneDeep(this.externalPrograms.defaultItems),
          ...this.$utils.cloneDeep(this.externalPrograms.items),
        ]
        this.dialog.data.programs = items
        if (this.dialog.specifiedHashID) {
          this.dialog.data.selectedProgram = items.find(item => {
            return item?.hashID === this.dialog.specifiedHashID
          })
        }
        else {
          this.dialog.data.selectedProgram = programTemplate
        }
        // Get data for selected items
        // Add ext to allowed list
        this.dialog.data.selectedProgram.selectedAllowedFileTypes = this.selectedDirItemsExtensions
        this.dialog.data.selectedProgram.selectedDisallowedFileTypes = []
        // Add ext to items list
        this.selectedDirItemsExtensions.forEach(ext => {
          if (!this.dialog.data.allowedFileTypes.includes(ext)) {
            this.dialog.data.allowedFileTypes.push(ext)
          }
        })
      }
      else {
        // Clean up data
        this.dialog.specifiedHashID = null
      }
    },
  },
  computed: {
    ...mapGetters([
      'selectedDirItemsExtensions',
    ]),
    ...mapState({
      dialog: state => state.dialogs.programEditorDialog,
      externalPrograms: state => state.storageData.settings.externalPrograms,
    }),
    filteredPrograms () {
      return this.dialog.data.programs.filter(program => !program.readonly)
    },
    programPathIsValid () {
      const path = this.dialog.data.selectedProgram.path
      const pathIsEmpty = path?.length === 0
      const pathExists = !pathIsEmpty && fs.existsSync(path)
      const pathIsFile = pathExists && fs.statSync(path).isFile()
      if (pathIsEmpty) {
        return {
          value: false,
          error: this.$t('dialogs.programEditorDialog.pathCannotBeEmpty'),
        }
      }
      if (!pathExists) {
        return {
          value: false,
          error: this.$t('dialogs.programEditorDialog.pathDoesNotExist'),
        }
      }
      if (!pathIsFile) {
        return {
          value: false,
          error: this.$t('dialogs.programEditorDialog.pathShouldBeAFile'),
        }
      }
      else {
        return {
          value: true,
          error: '',
        }
      }
    },
    programNameIsValid () {
      const name = this.dialog.data.selectedProgram.name
      const nameIsEmpty = name?.length === 0
      if (nameIsEmpty) {
        return {
          value: false,
          error: this.$t('dialogs.programEditorDialog.nameCannotBeEmpty'),
        }
      }
      else {
        return {
          value: true,
          error: '',
        }
      }
    },
    dialogIsValid () {
      return this.programNameIsValid.value &&
        this.programPathIsValid.value &&
        this.dialog.data.selectedProgram.targetTypes.length > 0
    },
  },
  methods: {
    addEditIcon (item) {
      return item.isTemplate
        ? 'mdi-plus'
        : 'mdi-pencil-outline'
    },
    addEditDescription (item) {
      const addDescription = `${this.$t('add')}: ${item.name}`
      const editDescription = `${this.$t('edit')}: ${item.name}`
      return item.isTemplate ? addDescription : editDescription
    },
    saveProgramChanges () {
      // If adding new program
      if (this.dialog.data.selectedProgram.isTemplate) {
        // Clean up selected program
        delete this.dialog.data.selectedProgram.isTemplate
        // Add program
        this.$store.dispatch(
          'ADD_EXTERNAL_PROGRAM',
          this.dialog.data.selectedProgram,
        )
      }
      // If editing existing program
      else {
        this.$store.dispatch(
          'EDIT_EXTERNAL_PROGRAM',
          this.dialog.data.selectedProgram,
        )
      }
      this.$store.dispatch('closeDialog', {name: 'programEditorDialog'})
    },
    deleteProgram () {
      this.$store.dispatch(
        'DELETE_EXTERNAL_PROGRAM',
        this.dialog.data.selectedProgram,
      )
      const programTemplate = this.$utils.cloneDeep(this.externalPrograms.programTemplate)
      programTemplate.isTemplate = true
      const items = [
        ...[programTemplate],
        ...this.$utils.cloneDeep(this.externalPrograms.defaultItems),
        ...this.$utils.cloneDeep(this.externalPrograms.items),
      ]
      this.dialog.data.programs = items
      this.dialog.data.selectedProgram = programTemplate
    },
    programInputHandler () {
    },
    onInputProgramPath () {
      const path = this.dialog.data.selectedProgram.path
      this.dialog.data.selectedProgram.path = path.replace(/\\/g, '/')
      const parsedPath = PATH.parse(this.dialog.data.selectedProgram.path)
      this.dialog.data.selectedProgram.name = parsedPath.name
    },
    onClickPickProgram () {
      electronRemote.dialog.showOpenDialog(currentWindow, {properties: ['openFile'] }).then(result => {
        // Parse name of selected file
        const filePath = result.filePaths[0].replace(/\\/g, '/')
        const parsedPath = PATH.parse(filePath)
        this.dialog.data.selectedProgram.path = filePath
        this.dialog.data.selectedProgram.name = parsedPath.name
      })
        .catch(error => {
          console.error(error)
          this.$eventHub.$emit('notification', {
            action: 'add',
            timeout: 3000,
            title: this.$t('dialogs.programEditorDialog.errorUnableToSelectTheProgram'),
          })
        })
    },
  },
}
</script>

<style scoped>

</style>