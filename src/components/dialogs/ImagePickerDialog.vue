<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'imagePickerDialog'}),
    }"
    :action-buttons="[
      {
        text: $t('dialogs.imagePickerDialog.cancel'),
        onClick: () => $store.dispatch('closeDialog', {name: 'imagePickerDialog'})
      },
      {
        text: $t('dialogs.imagePickerDialog.addImage'),
        onClick: () => dialog.data.loadImage(dialog.data)
      }
    ]"
    :title="$t('dialogs.imagePickerDialog.imagePicker')"
    max-width="50vw"
  >
    <template #content>
      <v-layout align-center>
        <v-text-field
          v-model="dialog.data.path"
          :label="$t('dialogs.imagePickerDialog.imagePath')"
          autofocus
          persistent-hint
          :hint="$t('dialogs.imagePickerDialog.pathUrlBase64String')"
          @input="imagePickerPathInputHandler()"
        />

        <v-tooltip bottom>
          <template #activator="{ on }">
            <v-btn
              icon
              v-on="on"
              @click="imagePickerPickProgramPath()"
            >
              <v-icon>
                mdi-eyedropper-variant
              </v-icon>
            </v-btn>
          </template>
          <span>{{$t('dialogs.imagePickerDialog.pickImage')}}</span>
        </v-tooltip>
      </v-layout>
      <v-layout
        wrap
        class="mt-2"
        style="gap: 64px"
      >
        <div>
          <div class="text--sub-title-1 mt-4 mb-2">
            {{$t('dialogs.imagePickerDialog.floatPosition')}}
          </div>
          <v-radio-group
            v-model="dialog.data.float"
            class="mt-2"
          >
            <v-radio
              :label="$t('left')"
              value="left"
            />
            <v-radio
              :label="$t('right')"
              value="right"
            />
            <v-radio
              :label="$t('none')"
              value="none"
            />
          </v-radio-group>
        </div>
        <div>
          <div class="text--sub-title-1 mt-4 mb-2">
            {{$t('dialogs.imagePickerDialog.dimensions')}}
          </div>
          <v-text-field
            v-model="dialog.data.width"
            :label="$t('width')"
            hide-details
            class="my-2"
          />
          <v-text-field
            v-model="dialog.data.height"
            :label="$t('height')"
            hide-details
            class="my-2"
          />
        </div>
      </v-layout>
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'

const electronRemote = require('@electron/remote')
const currentWindow = electronRemote.getCurrentWindow()

export default {
  computed: {
    ...mapState({
      dialog: state => state.dialogs.imagePickerDialog,
    }),
  },
  methods: {
    imagePickerPathInputHandler () {
    },
    imagePickerPickProgramPath () {
      electronRemote.dialog.showOpenDialog(currentWindow, {properties: ['openFile'] })
        .then(result => {
          const filePath = result.filePaths[0]
          this.dialog.data.path = filePath
        })
        .catch(error => {
          console.error(error)
          this.$eventHub.$emit('notification', {
            action: 'add',
            timeout: 5000,
            title: this.$t('dialogs.imagePickerDialog.errorCouldntPickImage'),
            message: this.$t('dialogs.imagePickerDialog.makeSurePickingImage'),
          })
        })
    },
  },
}
</script>

<style scoped>

</style>