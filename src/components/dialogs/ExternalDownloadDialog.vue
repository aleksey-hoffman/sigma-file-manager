<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'externalDownloadDialog'}),
    }"
    :action-buttons="[
      {
        text: $t('cancel'),
        onClick: () => $store.dispatch('closeDialog', {name: 'externalDownloadDialog'})
      },
      {
        text: $t('download'),
        onClick: () => initExternalVideoDownload()
      }
    ]"
    :title="$t('dialogs.externalDownloadDialog.downloadManager')"
    max-width="50vw"
  >
    <template #content>
      <div
        class="text--sub-title-1 mt-4 mb-2"
        style="word-break: break-all;"
      >
        {{$t('url')}}
      </div>
      <div>
        {{dialog.data.url}}
      </div>
      <div class="text--sub-title-1 mt-4 mb-2">
        {{$t('options')}}
      </div>
      <v-select
        v-model="dialog.data.video.selectedType"
        return-object
        item-text="title"
        item-value="name"
        :items="dialog.data.video.types"
        :label="$t('dialogs.externalDownloadDialog.downloadType')"
        class="mr-4"
      >
        <template #selection="{item}">
          {{$t(item.title)}}
        </template>
        <template #item="{item}">
          {{$t(item.title)}}
        </template>
      </v-select>
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'

const PATH = require('path')

export default {
  computed: {
    ...mapState({
      appVersion: state => state.appVersion,
      appPaths: state => state.storageData.settings.appPaths,
      dialog: state => state.dialogs.externalDownloadDialog,
    }),
  },
  methods: {
    initExternalVideoDownload () {
      // TODO: refactor
      const hashID = this.$utils.getHash()
      if (this.dialog.data.type === 'video') {
        let command = []
        let commandForFileName = []
        let fileName
        let path
        let destPathRaw = ''
        const directory = this.dialog.data.directory
        const overwriteExisting = true
        if (this.dialog.data.source === 'm3u8') {
          // fileName = 'file.mkv'
          fileName = 'file.ts'
          path = PATH.join(directory, fileName)

          command = [
            `"${this.appPaths.binFFMPEG}"`,
            `-${overwriteExisting ? 'y' : 'n'}`,
            '-i',
            `"${this.dialog.data.url}"`,
            '-vcodec',
            'copy',
            '-c',
            'copy',
            '-f',
            'matroska',
            `"${path}"`,
            // 'pipe:1'
          ]
        }
        if (this.dialog.data.source === 'youtube') {
          let format = 'bestvideo+bestaudio/best'
          destPathRaw = `${PATH.join(directory, '/%(title)s.%(ext)s')}`
          fileName = ''
          path = ''

          // Set download format
          if (this.dialog.data.video.selectedType.name === 'videoOnly') {
            format = 'bestvideo'
          }
          else if (this.dialog.data.video.selectedType.name === 'audioOnly') {
            format = 'bestaudio'
          }

          command = [
            `"${this.appPaths.binYtdlp}"`,
            `--ffmpeg-location "${this.appPaths.binFFMPEG}"`,
            `-f ${format}`,
            `-o "${destPathRaw}"`,
            `"${this.dialog.data.url}"`,
          ].join(' ').replace(/\n/g, ' ')

          commandForFileName = [
            `"${this.appPaths.binYtdlp}"`,
            '--get-filename',
            `-f ${format}`,
            `-o "${destPathRaw}"`,
            `"${this.dialog.data.url}"`,
          ].join(' ').replace(/\n/g, ' ')
        }

        this.$store.dispatch('EXEC_DOWNLOAD_VIDEO', {
          command,
          commandForFileName,
          hashID,
          destPathRaw,
          fileName,
          path,
          directory,
          source: this.dialog.data.source,
          type: this.dialog.data.type,
        })
      }
      this.$store.dispatch('closeDialog', {name: 'externalDownloadDialog'})
    },
  },
}
</script>

<style scoped>

</style>