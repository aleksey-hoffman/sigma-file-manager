<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <v-navigation-drawer
      class="info-panel"
      v-if="$vuetify.breakpoint.mdAndUp"
      v-model="navigatorViewInfoPanel.value"
      app clipped floating right stateless touchless width="280"
    >
      <div class="info-panel__preview-container">
        <div class="info-panel__preview-container__info-overlay">
          <v-icon
            class="info-panel__preview-container__info-overlay__item-type-icon"
            :class="previewIcon.class"
            @click="previewIcon.onClick()"
            :size="previewIcon.size"
            :aria-label="previewIcon.ariaLabel"
            :data-icon="previewIcon.dataIcon"
          >{{previewIcon.name}}
          </v-icon>

          <div 
            class="info-panel__preview-container__info-overlay__item-ext"
            v-show="['file', 'file-symlink'].includes(itemType)"
            v-html="itemExt"
          ></div>
          
          <div 
            class="info-panel__preview-container__info-overlay__audio-duration"
            v-show="itemMimeDescription === 'audio'"
          >{{formattedInfoPanelAudioDuration}}
          </div>
        </div>
        <div class="info-panel__preview-container__media-container"></div>
      </div>

      <div class="info-panel__info-container">
        <v-layout class="info-panel__header" column>
          <!-- info-container::header::title -->
          <v-tooltip bottom>
            <template v-slot:activator="{on}">
              <div
                v-on="on"
                @click.ctrl="$utils.copyToClipboard({
                  text: itemTitle
                })"
                class="info-panel__header__title"
                :class="{'cursor-pointer': inputState.ctrl}"
              >{{itemTitle}}
              </div>
            </template>
            <span>To copy: Ctrl + LClick</span>
          </v-tooltip>

          <!-- info-container::header::description -->
          <div 
            class="info-panel__header__sub-title"
            v-html="itemDescription"
          ></div>
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
              {{itemSizeTitle}}:
            </div>

            <!-- button::get-size -->
            <v-layout align-center>
              <div>
                <v-btn
                  v-show="itemInfoSizeButton.show"
                  @click.exact="handleItemInfoSizeButtonClick()"
                  class="info-panel__properties__item__value mb-0 button-2 fade-in-1s"
                  style="max-height: 20px;"
                  x-small
                >
                  <div
                    class="fade-in-1s"
                    v-show="showGetDirSizeBtn"
                  >
                    {{itemInfoSizeButton.title}}
                  </div>
                  <div
                    class="fade-in-1s"
                    v-show="showCancelGetDirSizeBtn"
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
                <template v-slot:activator="{on}">
                  <div
                    v-on="on"
                    v-show="!showGetDirSizeBtn && !showCancelGetDirSizeBtn"
                    @click.ctrl="$utils.copyToClipboard({
                      text: $utils.prettyBytes(lastSelectedDirItem.stat.size, 1)
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
            v-for="(item, index) in navigatorViewInfoPanel.data.properties"
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
              <template v-slot:activator="{on}">
                <div
                  v-on="on"
                  @click="handleClickPropertyValue({event: $event, item})"
                  class="info-panel__properties__item__value"
                  :class="{'cursor-pointer': inputState.ctrl}"
                >{{item.value}}
                </div>
              </template>
              <span v-html="item.tooltip"></span>
            </v-tooltip>
          </v-layout>
        </div>
      </div>
    </v-navigation-drawer>
  </div>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'

export default {
  data () {
    return {
      infoPanelAudioIsPlaying: false,
      infoPanelAudioDuration: 0,
      itemInfoSizeButtonState: 'idle'
    }
  },
  created () {
    this.showInfoPanel()
  },
  watch: {
    'lastSelectedDirItem.path' () {
      this.$nextTick(() => {
        this.updateInfoPanelData()
      })
    }
  },
  computed: {
    ...mapGetters([
      'selectedDirItems',
      'lastSelectedDirItem'
    ]),
    ...mapFields({
      inputState: 'inputState',
      navigatorViewInfoPanel: 'storageData.settings.infoPanels.navigatorView',
      autoCalculateDirSize: 'storageData.settings.autoCalculateDirSize',
    }),
    itemExt () {
      return this.$utils.getExt(this.lastSelectedDirItem?.path || '')
    },
    itemDescription () {
      let type = this.lastSelectedDirItem?.type || ''
      let inaccessible = this.lastSelectedDirItem?.isInaccessible
        ? ' • Inaccessible'
        : ''
      let isOffline = this.lastSelectedDirItem?.status.includes('offline')
        ? ' • Offline'
        : ''
      let keepOnDevice = this.lastSelectedDirItem?.fsAttributes?.includes?.('525344')
        ? ' • Keep on device'
        : ''
      let itemMimeDescription = this.itemMimeDescription
        ? ` • ${this.itemMimeDescription}`
        : ''
      let description = this.$localize.get(`text_${type.replace(/-/g,'_')}`)
      return `${description}${itemMimeDescription}${isOffline}${keepOnDevice}${inaccessible}`
    },
    itemType () {
      return this.lastSelectedDirItem?.type || ''  
    },
    itemMimeDescription () {
      return this.lastSelectedDirItem?.mime.mimeDescription || ''  
    },
    itemTitle () {
      return this.lastSelectedDirItem?.name || ''  
    },
    itemSizeTitle () {
      let type = this.lastSelectedDirItem?.type || ''
      return type === 'directory'
        ? this.$localize.get('text_directory_size')
        : this.$localize.get('text_file_size')
    },
    previewIcon () {
      const type = this.lastSelectedDirItem?.type
      const itemMimeDescription = this.lastSelectedDirItem?.mime.mimeDescription
      const icon = {
        name: '',
        size: '56px',
        class: 'info-panel__media-preview__icon'
      }

      if (type === 'directory') {
        icon.name = 'mdi-folder-outline'
      }
      else if (type === 'directory-symlink') {
        icon.name = 'mdi-folder-move-outline'
      }
      else if (type === 'file' && itemMimeDescription === 'image') {
        icon.name = 'mdi-image-outline'
      }
      else if (type === 'file' && itemMimeDescription === 'video') {
        icon.name = 'mdi-play-circle-outline'
      }
      else if (type === 'file' && itemMimeDescription === 'audio' && !this.infoPanelAudioIsPlaying) {
        icon.name = 'mdi-play-outline'
        icon.size = '48px'
        icon.class = 'info-panel__media-preview__play info-panel__media-preview__icon'
        icon.ariaLabel = 'play pause toggle'
        icon.dataIcon = 'P'
        icon.onClick = this.toggleAudioPlay
      }
      else if (type === 'file' && itemMimeDescription === 'audio' && this.infoPanelAudioIsPlaying) {
        icon.name = 'mdi-pause-circle-outline'
        icon.size = '48px'
        icon.class = 'info-panel__media-preview__play info-panel__media-preview__icon'
        icon.ariaLabel = 'play pause toggle'
        icon.dataIcon = 'P'
        icon.onClick = this.toggleAudioPlay
      }
      else if (type === 'file') {
        icon.name = 'mdi-file-outline'
      }
      else if (type === 'file-symlink') {
        icon.name = 'mdi-file-move-outline'
      }

      return icon
    },
    showGetDirSizeBtn () {
      return this.lastSelectedDirItem?.stat?.size === null && this.itemInfoSizeButtonState === 'idle'
    },
    showCancelGetDirSizeBtn () {
      return this.lastSelectedDirItem?.stat?.size === null && this.itemInfoSizeButtonState === 'ongoing'
    },
    itemInfoSizeButton () {
      const show = this.showGetDirSizeBtn || this.showCancelGetDirSizeBtn
      if (this.showCancelGetDirSizeBtn) {
        return {
          show,
          title: this.$localize.get('text_cancel'),
        }
      }
      else {
        return {
          show,
          title: this.$localize.get('text_get_size'),
        }
      }
    },
    getSize () {
      try {
        const sizeOnDisk = this.lastSelectedDirItem?.sizeOnDisk === 0
          ? ` • 0 bytes on disk`
          : ''
        const size = this.$utils.prettyBytes(this.lastSelectedDirItem?.stat?.size, 1)
        return `${size}${sizeOnDisk}`
      }
      catch (error) {
        return 'unknown'
      }
    },
    shouldFetchMediaPreview () {
      const itemMimeDescription = this.lastSelectedDirItem?.mime.mimeDescription
      const isInaccessible = this.lastSelectedDirItem?.isInaccessible
      const itemIsOffline = this.lastSelectedDirItem?.sizeOnDisk === 0
      const isMediaType = ['image', 'audio', 'video'].includes(itemMimeDescription)
      return (!isInaccessible && !itemIsOffline) || !isMediaType
    },
    formattedInfoPanelAudioDuration () {
      return this.$utils.getFormattedTime({
        time: this.infoPanelAudioDuration,
        unit: 'seconds',
        format: 'HH:mm:ss'
      })
    }
  },
  methods: {
    async handleItemInfoSizeButtonClick () {
      if (this.itemInfoSizeButtonState === 'idle') {
        this.itemInfoSizeButtonState = 'ongoing'
        await this.$store.dispatch('FETCH_CURRENT_DIR_SIZE')
        this.itemInfoSizeButtonState = 'idle'
      }
      else {
        this.itemInfoSizeButtonState = 'idle' 
        this.$store.dispatch('TERMINATE_ALL_FETCH_DIR_SIZE')
      }
    },
    async updateInfoPanelData () {
      this.navigatorViewInfoPanel.data = this.getInfoPanelData()
      await this.fetchPreview()
      this.cancelFetchDirSize()
      this.initAutoFetchDirSize()
    },
    async initAutoFetchDirSize () {
      if (this.autoCalculateDirSize) {
        if (this.itemInfoSizeButtonState === 'idle') {
          this.itemInfoSizeButtonState = 'ongoing'
          await this.$store.dispatch('AUTO_CALCULATE_DIR_SIZE', this.lastSelectedDirItem)
          this.itemInfoSizeButtonState = 'idle'
        }
      }
    },
    cancelFetchDirSize () {
      this.itemInfoSizeButtonState = 'idle'
      this.$store.dispatch('TERMINATE_ALL_FETCH_DIR_SIZE')
    },
    getPreviewMediaSrc () {
      const itemMimeDescription = this.lastSelectedDirItem?.mime.mimeDescription
      const mediaPath = this.lastSelectedDirItem?.realPath || ''
      if (itemMimeDescription === 'image') {
        return this.$storeUtils.getSafePath(this.$sharedUtils.getUrlSafePath(mediaPath))
      }
      else if (itemMimeDescription === 'audio') {
        return this.$storeUtils.getSafePath(this.$sharedUtils.getUrlSafePath(mediaPath))
      }
      else if (itemMimeDescription === 'video') {
        return `${this.$storeUtils.getSafePath(this.$sharedUtils.getUrlSafePath(mediaPath))}#t=0.5`
      }
      else {
        return ''
      }
    },
    getInfoPanelData () {
      let item = this.lastSelectedDirItem
      if (!item.path) {return}
      const {isReadOnly, permissions} = this.$utils.getItemPermissions(item)
      const isDirItemPinned = this.$store.state.storageData.pinned.items
        .some(listItem => listItem.path === item.path)
      const isDirItemProtected = this.$store.state.storageData.protected.items
        .some(listItem => listItem.path === item.path)
      const copyShortcut = 'Ctrl + LClick'

      let copyPathTooltip
      if (this.$sharedUtils.platform === 'win32') {
        copyPathTooltip = `
          <div>
            <span class="inline-code--light">${copyShortcut}</span> 
              - copy path with 
              <span class="inline-code--light">\\</span> 
              slashes
          </div>
          <div>
            <span class="inline-code--light">Ctrl + Alt + LClick</span> 
              - copy path with 
              <span class="inline-code--light">\\\\</span> 
              slashes
          </div>
        `
      }
      else {
        copyPathTooltip = `${this.$localize.get('tooltip_text_to_copy')}: ${copyShortcut}`
      }

      // Define main properties
      const properties = [
        {
          propName: 'path',
          title: this.$localize.get('text_path'),
          value: item.path,
          tooltip: copyPathTooltip
        },
        {
          propName: 'dateCreated',
          title: this.$localize.get('text_created'),
          value: this.$utils.getLocalDateTime(item.stat.birthtime, this.$store.state.storageData.settings.dateTime),
          tooltip: `${this.$localize.get('tooltip_text_to_copy')}: ${copyShortcut}`
        },
        {
          propName: 'dateModified',
          title: this.$localize.get('text_modified'),
          value: this.$utils.getLocalDateTime(item.stat.mtime, this.$store.state.storageData.settings.dateTime),
          tooltip: `${this.$localize.get('tooltip_text_to_copy')}: ${copyShortcut}`
        },
        {
          propName: 'dateChanged',
          title: this.$localize.get('text_changed'),
          value: this.$utils.getLocalDateTime(item.stat.ctime, this.$store.state.storageData.settings.dateTime),
          tooltip: `${this.$localize.get('tooltip_text_to_copy')}: ${copyShortcut}`
        },
        {
          propName: 'permissions',
          title: this.$localize.get('text_mode'),
          value: permissions,
          tooltip: `${this.$localize.get('tooltip_text_to_copy')}: ${copyShortcut}`
        },
        {
          propName: 'protected',
          title: this.$localize.get('text_protected'),
          value: isDirItemProtected
            ? this.$localize.get('text_yes')
            : this.$localize.get('text_no'),
          tooltip: `
            Protected items cannot be modified or deleted (from within this app only). 
            Protected items can be found on the dashboard page.
          `
        },
        {
          propName: 'pinned',
          title: this.$localize.get('text_pinned'),
          value: isDirItemPinned
            ? this.$localize.get('text_yes')
            : this.$localize.get('text_no'),
          tooltip: 'Pinned items can be found on the dashboard page'
        }
      ]

      // Append conditional properties
      const realPath = {
        propName: 'realPath',
        title: this.$localize.get('text_real_path'),
        value: item.realPath,
        tooltip: copyPathTooltip
      }
      if (item.path !== item.realPath) {
        properties.splice(1, 0, realPath)
      }

      return {
        properties
      }
    },
    async fetchPreview () {
      const itemMimeDescription = this.lastSelectedDirItem?.mime.mimeDescription
      const isMediaType = ['image', 'audio', 'video'].includes(itemMimeDescription)
      this.clearMediaContainer()
      if (!this.shouldFetchMediaPreview) {return}

      if (isMediaType) {
        this.fetchMediaPreview()
      }
      else {
        this.fetchNonMediaPreview()
      }
    },
    async fetchMediaPreview () {
      const itemMimeDescription = this.lastSelectedDirItem?.mime.mimeDescription
      let mediaNode
      if (itemMimeDescription === 'image') {
        mediaNode = new Image()
        await this.setImageMedia(mediaNode)
        // this.$store.dispatch('GENERATE_THUMBNAIL', {item: this.lastSelectedDirItem})
      }
      else if (itemMimeDescription === 'audio') {
        mediaNode = new Audio()
        await this.setAudioMedia(mediaNode)
        this.infoPanelAudioDuration = 0
        mediaNode.onloadedmetadata = () => {
          this.infoPanelAudioDuration = mediaNode.duration
        }
      }
      else if (itemMimeDescription === 'video') {
        mediaNode = document.createElement('video')
        await this.setVideoMedia(mediaNode)
      }
      mediaNode.classList.add('info-panel__preview-container__media', 'fade-in-1s')
      this.replaceMedia(mediaNode)
    },
    fetchNonMediaPreview () {
      this.clearMediaContainer()
    },
    clearMediaContainer () {
      this.replaceMedia(document.createElement('div'))
    },
    async setImageMedia (mediaNode) {
      mediaNode.src = this.getPreviewMediaSrc()
      await mediaNode.decode()
    },
    async setAudioMedia (mediaNode) {
      mediaNode.src = this.getPreviewMediaSrc()
      mediaNode.setAttribute('controls', true)
      mediaNode.setAttribute('preload', 'metadata')
      mediaNode.style.display = 'none'
    },
    async setVideoMedia (mediaNode) {
      mediaNode.src = this.getPreviewMediaSrc()
      mediaNode.setAttribute('controls', true)
      mediaNode.setAttribute('preload', 'metadata')
    },
    replaceMedia (mediaNode) {
      let mediaContainerNode = document.querySelector('.info-panel__preview-container__media-container')
      mediaContainerNode.replaceChildren(mediaNode)
    },
    handleClickPropertyValue (params) {
      const isPath = ['path', 'realPath'].includes(params.item.propName)
      let title
      if (isPath) {
        title = 'Path was copied to clipboard'
      }
      if (params.event.ctrlKey && !params.event.altKey) {
        this.$utils.copyToClipboard({
          text: params.item.value,
          asPath: isPath,
          pathSlashes: 'single-backward',
          title
        })
      }
      else if (params.event.ctrlKey && params.event.altKey) {
        this.$utils.copyToClipboard({
          text: params.item.value,
          asPath: isPath,
          pathSlashes: 'double-backward',
          title
        })
      }
    },
    showInfoPanel () {
      if (this.navigatorViewInfoPanel.value) {
        this.navigatorViewInfoPanel.value = false
        setTimeout(() => {
          this.navigatorViewInfoPanel.value = true
        }, 200)
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
  position: relative;
  width: 280px;
  height: 158px;
  background-color: var(--info-panel-preview-container-bg-color);
}

.info-panel__preview-container__media-container * {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  object-fit: cover;
}

.info-panel__preview-container__media-container *:focus {
  outline: none;
  border: none;
}

.info-panel__preview-container__info-overlay {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.info-panel__preview-container__info-overlay__audio-duration {
  margin-top: 6px;
  font-size: 14px;
}

.info-panel__media-preview__play {
  z-index: 1;
  cursor: pointer;
}

.info-panel__info-container {
  width: 100%;
  padding: 8px 24px;
}

.info-panel__header {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.info-panel__header
  * {
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

.info-panel__header__title {
  color: var(--title-color-1);
  font-size: 18px;
}

.info-panel__header__sub-title {
  color: var(--title-color-1);
  font-size: 14px;
}

.info-panel__properties {
  position: relative;
  margin-bottom: 8px;
  padding-bottom: 16px;
  height: calc(
    100vh
    - var(--window-toolbar-height)
    - var(--action-toolbar-height)
    - 158px - 32px - 16px - 36px
  );
  color: var(--color-1);
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
  margin-right: 8px;
  color: var(--color-6);
  font-size: 12px;
  text-transform: uppercase;
}

.info-panel__properties__item__value {
  margin-bottom: 8px;
  color: var(--color-7);
  font-size: 14px;
  word-break: break-all;
}

.info-panel
  .v-navigation-drawer__content {
    overflow-y: hidden;
  }
</style>
