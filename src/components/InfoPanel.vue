<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <v-navigation-drawer
      class="info-panel"
      v-if="$vuetify.breakpoint.mdAndUp"
      v-model="navigatorViewInfoPanel"
      app
      clipped
      floating
      right
      stateless
      touchless
      width="280"
    >
      <v-layout
        class="info-panel__preview-container"
        align-center
        column
        justify-center
      >
        <v-icon
          :class="previewIcon.class"
          @click="() => {previewIcon.onClick()}"
          :size="previewIcon.size"
          :aria-label="previewIcon.ariaLabel"
          :data-icon="previewIcon.dataIcon"
        >{{previewIcon.name}}
        </v-icon>

        <!-- preview::media-elements -->
        <div class="info-panel__preview-container__media-container">
          <img
            class="fade-in-1s info-panel__preview-container__media"
            v-if="showPreviewItem('image') && !selectedDirItemData.itemProps.isInaccessible"
            :src="previewMediaSrc"
          >
          <audio
            class="fade-in-1s info-panel__preview-container__media"
            v-if="showPreviewItem('audio') && !selectedDirItemData.itemProps.isInaccessible"
            :src="previewMediaSrc"
            controls
            preload="metadata"
            style="display: none"
          />
          <video
            class="fade-in-1s info-panel__preview-container__media"
            v-if="showPreviewItem('video') && !selectedDirItemData.itemProps.isInaccessible"
            :src="previewMediaSrc"
            controls
            preload="metadata"
          />
        </div>

        <!-- preview::mime -->
        <div v-show="['file', 'file-symlink'].includes(infoPanelThumbType)">
          {{$utils.getExt(selectedDirItemData.title)}}
        </div>
      </v-layout>

      <!-- info-container -->
      <div class="info-panel__info-container">
        <v-layout class="info-panel__header" column>
          <!-- info-container::header::title -->
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <div
                v-on="on"
                @click.ctrl="$utils.copyToClipboard({
                  text: selectedDirItemData.title
                })"
                class="info-panel__header__title"
                :class="{'cursor-pointer': inputState.ctrl}"
              >{{selectedDirItemData.title}}
              </div>
            </template>
            <span>To copy: Ctrl + LClick</span>
          </v-tooltip>

          <!-- info-container::header::description -->
          <div class="info-panel__header__sub-title">
            {{selectedDirItemData.description}}
          </div>
        </v-layout>

        <v-divider class="my-3"></v-divider>

        <!-- info-container::properties -->
        <div class="info-panel__properties custom-scrollbar">
          <!-- info-container::properties::size -->
          <v-layout
            class="info-panel__properties__item"
            column
          >
            <!-- info-container::properties::size::title -->
            <div class="info-panel__properties__item__title">
              {{
                selectedDirItemData.type === 'directory'
                  ? $localize.get('text_directory_size')
                  : $localize.get('text_file_size')
             }}:
            </div>

            <!-- button::get-size -->
            <v-layout align-center>
              <div>
                <v-btn
                  v-show="itemInfoSizeButton.show"
                  @click.exact="itemInfoSizeButton.onClick"
                  class="info-panel__properties__item__value mb-0 button-2 fade-in-1s"
                  style="max-height: 20px;"
                  x-small
                >
                  <div
                    class="fade-in-1s"
                    v-show="itemInfoSizeButton.state === 'idle'"
                  >
                    {{itemInfoSizeButton.title}}
                  </div>
                  <div
                    class="fade-in-1s"
                    v-show="itemInfoSizeButton.state === 'ongoing'"
                  >
                    <v-progress-circular
                      class="mr-2 fade-in-1s"
                      indeterminate
                      :color="$utils.getCSSVar('--color-6')"
                      size="12"
                      width="2"
                    ></v-progress-circular>
                    {{itemInfoSizeButton.title}}
                  </div>
                </v-btn>
              </div>

              <!-- property:size -->
              <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                  <div
                    v-on="on"
                    v-show="!showGetDirSizeBtn && !showCancelGetDirSizeBtn"
                    @click.ctrl="$utils.copyToClipboard({
                      text: $utils.prettyBytes(selectedDirItems.getLast().stat.size, 1)
                    })"
                    class="info-panel__properties__item__value"
                    :class="{'cursor-pointer': inputState.ctrl}"
                  >
                    {{getSize}}
                  </div>
                </template>
                <span>To copy: Ctrl + LClick</span>
              </v-tooltip>
            </v-layout>
          </v-layout>

          <!-- properties -->
          <v-layout
            v-for="(item, index) in selectedDirItemData.properties"
            :key="index"
            class="info-panel__properties__item fade-in-500ms"
            column
          >
            <!-- property-title -->
            <div
              class="info-panel__properties__item__title"
              v-html="item.title"
            >:
            </div>

            <!-- property-value -->
            <v-tooltip
              :disabled="item.tooltip.length === 0"
              bottom max-width="250px" offset-overflow
            >
              <template v-slot:activator="{ on }">
                <div
                  v-on="on"
                  @click.ctrl="$utils.copyToClipboard({
                    text: item.value
                  })"
                  class="info-panel__properties__item__value"
                  :class="{'cursor-pointer': inputState.ctrl}"
                >{{item.value}}
                </div>
              </template>
              <span>{{item.tooltip}}</span>
            </v-tooltip>
          </v-layout>
        </div>
      </div>
    </v-navigation-drawer>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import { mapFields } from 'vuex-map-fields'

export default {
  data () {
    return {
      infoPanelAudioIsPlaying: false
    }
  },
  created () {
    this.delayInfoPanel()
  },
  computed: {
    ...mapGetters([
      'selectedDirItems'
    ]),
    ...mapFields({
      navigatorViewInfoPanel: 'storageData.settings.infoPanels.navigatorView'
    }),
    ...mapState({
      selectedDirItemData: state => state.navigatorView.infoPanelData,
      placeholders: state => state.placeholders,
      inputState: state => state.inputState
    }),
    infoPanelThumbType () {
      const itemMime = this.selectedDirItemData.mimeDescription
      const itemIsDirectory = this.selectedDirItemData.type === 'directory'
      const itemIsDirectorySymlink = this.selectedDirItemData.type === 'directory-symlink'
      const itemIsFile = this.selectedDirItemData.type === 'file'
      const itemIsFileSymlink = this.selectedDirItemData.type === 'file-symlink'
      const itemMimeIsMediaType = ['image', 'video', 'audio'].includes(itemMime)
      if (itemIsDirectory) {
        return 'directory'
      }
      if (itemIsDirectorySymlink) {
        return 'directory-symlink'
      }
      else if (itemIsFile && !itemMimeIsMediaType) {
        return 'file'
      }
      else if (itemIsFileSymlink && !itemMimeIsMediaType) {
        return 'file-symlink'
      }
      else if (itemMime === 'audio' && !this.infoPanelAudioIsPlaying) {
        return 'file-audio'
      }
      else if (itemMime === 'audio' && this.infoPanelAudioIsPlaying) {
        return 'file-audio-playing'
      }
      else {
        return ''
      }
    },
    previewIcon () {
      const icon = {
        name: '',
        size: '56px',
        class: 'info-panel__media-preview__icon'
      }
      if (this.infoPanelThumbType === 'directory') {
        icon.name = 'mdi-folder-outline'
      }
      else if (this.infoPanelThumbType === 'directory-symlink') {
        icon.name = 'mdi-folder-move-outline'
      }
      else if (this.infoPanelThumbType === 'file') {
        icon.name = 'mdi-file-outline'
      }
      else if (this.infoPanelThumbType === 'file-symlink') {
        icon.name = 'mdi-file-move-outline'
      }
      else if (this.infoPanelThumbType === 'file-audio') {
        icon.name = 'mdi-play-circle-outline'
        icon.size = '48px'
        icon.class = 'info-panel__media-preview__play info-panel__media-preview__icon'
        icon.ariaLabel = 'play pause toggle'
        icon.dataIcon = 'P'
        icon.onClick = this.toggleAudioPlay
      }
      else if (this.infoPanelThumbType === 'file-audio-playing') {
        icon.name = 'mdi-pause-circle-outline'
        icon.size = '48px'
        icon.class = 'info-panel__media-preview__play info-panel__media-preview__icon'
        icon.ariaLabel = 'play pause toggle'
        icon.dataIcon = 'P'
        icon.onClick = this.toggleAudioPlay
      }
      return icon
    },
    previewMediaSrc () {
      const itemMime = this.selectedDirItemData.mimeDescription
      const mediaPath = this.selectedDirItems.getLast().realPath
      if (itemMime === 'image') {
        return this.$storeUtils.getSafePath(this.$sharedUtils.getUrlSafePath(mediaPath))
      }
      else if (itemMime === 'audio') {
        return this.$storeUtils.getSafePath(this.$sharedUtils.getUrlSafePath(mediaPath))
      }
      else if (itemMime === 'video') {
        return `${this.$storeUtils.getSafePath(this.$sharedUtils.getUrlSafePath(mediaPath))}#t=0.5`
      }
      else {
        return ''
      }
    },
    showGetDirSizeBtn () {
      return this.selectedDirItems?.getLast()?.stat?.size === null
    },
    showCancelGetDirSizeBtn () {
      return this.selectedDirItems?.getLast()?.stat?.size === this.placeholders.calculatingDirSize
    },
    itemInfoSizeButton () {
      const show = this.showGetDirSizeBtn || this.showCancelGetDirSizeBtn
      if (this.showCancelGetDirSizeBtn) {
        return {
          show,
          title: 'cancel',
          state: 'ongoing',
          onClick: () => this.$store.dispatch('CANCEL_FETCH_CURRENT_DIR_SIZE')
        }
      }
      else {
        return {
          show,
          title: this.$localize.get('text_get_size'),
          state: 'idle',
          onClick: () => this.$store.dispatch('FETCH_CURRENT_DIR_SIZE')
        }
      }
    },
    getSize () {
      try {
        return this.$utils.prettyBytes(this.selectedDirItems.getLast().stat.size, 1)
      }
      catch (error) {
        return 'unknown'
      }
    }
  },
  methods: {
    showPreviewItem (mediaType) {
      const itemMime = this.selectedDirItemData.mimeDescription
      return itemMime === mediaType
    },
    delayInfoPanel () {
      if (this.navigatorViewInfoPanel) {
        this.navigatorViewInfoPanel = false
        setTimeout(() => {
          this.navigatorViewInfoPanel = true
        }, 100)
      }
    },
    toggleAudioPlay () {
      const media = document.querySelector('.info-panel__preview-container__media')
      const play = document.querySelector('.info-panel__media-preview__play')
      if (media.paused) {
        play.setAttribute('data-icon', 'u')
        this.infoPanelAudioIsPlaying = true
        media.play()
      }
      else {
        play.setAttribute('data-icon', 'P')
        this.infoPanelAudioIsPlaying = false
        media.pause()
      }
    }
  }
}
</script>

<style>
.info-panel {
  top: var(--header-height) !important;
  padding-bottom: var(--window-toolbar-height) !important;
  background-color: var(--info-panel-bg-color) !important;
  overflow: hidden !important;
  box-shadow: var(--info-panel-shadow);
}

.info-panel
  .v-divider {
    background-color: var(--divider-color-2) !important;
  }

.info-panel__preview-container {
  width: 280px;
  height: 158px;
  background-color: var(--info-panel-preview-container-bg-color);
  position: relative;
}

.info-panel__preview-container__media-container * {
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  object-fit: cover;
  position: absolute;
}

.info-panel__preview-container__media-container *:focus {
  outline: none;
  border: none;
}

.info-panel__media-preview__play {
  cursor: pointer;
  z-index: 1;
}

.info-panel__info-container {
  width: 100%;
  padding: 8px 24px;
}

.info-panel__header {
  margin-top: 8px;
  display: flex;
  align-items: center;
}

.info-panel__header
  * {
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

.info-panel__header__title {
  font-size: 18px;
  color: var(--title-color-1);
}

.info-panel__header__sub-title {
  font-size: 14px;
  color: var(--title-color-1);
}

.info-panel__properties {
  position: relative;
  color: var(--color-1);
  margin-bottom: 8px;
  padding-bottom: 16px;
  height: calc(
    100vh
    - var(--window-toolbar-height)
    - var(--action-toolbar-height)
    - 158px - 32px - 16px - 36px
  );
  -webkit-mask-image: linear-gradient(180deg, #fff 85%,transparent);
}

.info-panel__properties__item {
  min-height: 48px;
  margin-bottom: 4px;
}

.info-panel__properties
  .v-btn {
    height: 24px !important;
  }

.info-panel__properties__item__title {
  user-select: none;
  color: var(--color-6);
  font-size: 12px;
  margin-right: 8px;
  /* text-transform: capitalize; */
  text-transform: uppercase;
}

.info-panel__properties__item__value {
  color: var(--color-7);
  font-size: 14px;
  margin-bottom: 8px;
  word-break: break-all;
}

.info-panel
  .v-navigation-drawer__content {
    overflow-y: hidden;
  }
</style>
