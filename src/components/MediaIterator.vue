<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div class="media-picker__container">
    <!-- item -->
    <div
      v-for="(item, index) in items"
      :key="item.id"
      @click="$store.dispatch('SET_HOME_BANNER_BACKGROUND', item)"
      class="media-picker__item"
      :data-selected="item.path === homeBannerSelectedItem.path"
      :data-path="item.path"
    >
      <div class="progress">LOADING</div>
      <div class="media-picker__item-thumb-container"></div>
      <div class="media-picker__item-icon-container">
        <!-- item::icon:selected -->
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              v-on="on"
              v-show="item.path === homeBannerSelectedItem.path"
              @click.stop=""
              icon
              class="media-picker__item-icon--selected"
            >
              <v-icon
              >mdi-checkbox-marked-outline
              </v-icon>
            </v-btn>
          </template>
          <span>Selected</span>
        </v-tooltip>

        <!-- item::button:source-link -->
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              v-on="on"
              v-if="item.sourceLink"
              @click.stop="$utils.openLink(item.sourceLink)"
              icon
              class="media-picker__item-icon--source-link"
            >
              <v-icon
              >mdi-link-variant
              </v-icon>
            </v-btn>
          </template>
          <span>
            See more artworks from this artist
            <v-layout align-center>
              <v-icon class="mr-3" size="16px">
                mdi-open-in-new
              </v-icon>
              {{item.sourceLink}}
            </v-layout>
          </span>
        </v-tooltip>

        <!-- item::button:support-link -->
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              v-on="on"
              v-if="item.supportLink"
              @click.stop="$utils.openLink(item.supportLink)"
              icon
              class="media-picker__item-icon--support-link"
            >
              <v-icon
              >mdi-heart-outline
              </v-icon>
            </v-btn>
          </template>
          <span>
            Support this artist
            <v-layout align-center>
              <v-icon class="mr-3" size="16px">
                mdi-open-in-new
              </v-icon>
              {{item.supportLink}}
            </v-layout>
          </span>
        </v-tooltip>

        <!-- item::button:remove -->
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              v-if="type === 'custom'"
              v-on="on"
              @click.stop="$store.dispatch('DELETE_HOME_PAGE_BACKGROUND', item)"
              icon
              class="media-picker__item-icon--remove"
            >
              <v-icon
              >mdi-trash-can-outline
              </v-icon>
            </v-btn>
          </template>
          <span>Delete file</span>
        </v-tooltip>
      </div>

      <v-layout
        column align-center justify-center
        class="media-picker__item-overlay--description"
      >
        <div>{{$utils.getPathPart(item.fileNameBase, 'name')}}</div>
        <div>Type: {{item.type}}</div>
      </v-layout>
    </div>
  </div>
</template>

<script>
import { mapFields } from 'vuex-map-fields'
import { mapState } from 'vuex'
const fs = require('fs')
const PATH = require('path')
const ffmpeg = require('fluent-ffmpeg')

export default {
  props: {
    items: Array,
    type: String,
    options: Object
  },
  data () {
    return {
      itemObserver: null
    }
  },
  mounted () {
    // Delaying to avoid UI stuttering
    setTimeout(() => {
      this.initEventHubListeners()
      this.observeDirItems()
    }, 500)
  },
  destroyed () {
    this.removeEventHubListeners()
  },
  computed: {
    ...mapFields({
      homeBannerSelectedItem: 'storageData.settings.homeBanner.selectedItem'
    }),
    ...mapState({
      appPaths: state => state.appPaths
    })
  },
  methods: {
    initEventHubListeners () {
      this.$eventHub.$on('media-iterator:method', this.mediaIteratorMethodHandler)
    },
    removeEventHubListeners () {
      this.$eventHub.$off('media-iterator:method', this.mediaIteratorMethodHandler)
    },
    mediaIteratorMethodHandler (payload) {
      this[payload.method](payload.params)
    },
    observeDirItems () {
      try {
        this.itemObserver.disconnect()
      }
      catch (error) {}

      // Init intersection observer
      const options = {
        rootMargin: '200px 0px',
        threshold: 0
      }
      this.itemObserver = new IntersectionObserver(this.itemObserverHandler, options)

      // Observe each item
      const fileItems = document.querySelectorAll('.media-picker__item')
      fileItems.forEach(fileItem => {
        this.itemObserver.observe(fileItem)
      })
    },
    itemObserverHandler (entries, observer) {
      for (const entry of entries) {
        const path = entry.target.dataset.path.replace(/\\/g, '/')
        const itemThumbContainer = entry.target.querySelector('.media-picker__item-thumb-container')
        if (entry.isIntersecting) {
          itemThumbContainer.classList.add('fade-in-1s')
          if (this.options.loadOnce) {
            if (itemThumbContainer.childElementCount === 0) {
              this.addThumb(itemThumbContainer, path)
            }
          }
          else {
            this.removeThumb(itemThumbContainer, path)
            this.addThumb(itemThumbContainer, path)
          }
        }
        else {
          // itemThumbContainer.classList.remove('fade-in-1s')
          // this.removeThumb(itemThumbContainer, path)
        }
      }
    },
    addThumb (target, path) {
      // Add thumb
      const itemType = this.$utils.getFileType(path)
      if (itemType.mimeDescription === 'image') {
        // TODO: temporarily removed the ability to generate thumbs for default media
        // because FFMPEG cannot access images inside asar. 
        // Need to move the default images to appStorage.
        // Using original full res images instead 
        if (this.type === 'default') {
          const image = this.createElement('image', target, path)
          this.replaceThumb(target, image)
        }
        else {
          this.createImageThumb(target, path)
        }
      }
      else if (itemType.mimeDescription === 'video') {
        const video = this.createElement('video', target, path)
        this.replaceThumb(target, video)
      }
    },
    replaceThumb (target, node) {
      // Remove previous thumb
      while (target.hasChildNodes()) {
        target.removeChild(target.lastChild)
      }
      // Append new thumb
      target.appendChild(node)
    },
    removeThumb (target, path) {
      // Remove previous thumb
      target
        .querySelectorAll('.media-picker__item-thumb')
        .forEach(element => element.remove())
    },
    async createImageThumb (target, path) {
      await this.fetchImageThumbnail(target, path)
    },
    async fetchImageThumbnail (target, path) {
      // Check if thumb dir exists. If not, create it
      if (!fs.existsSync(this.appPaths.storageDirectories.appStorageNavigatorThumbs)) {
        fs.mkdirSync(this.appPaths.storageDirectories.appStorageNavigatorThumbs, { recursive: true })
      }
      // Parse image path
      const parsedFileName = PATH.parse(path)
      const fileExt = parsedFileName.ext

      // Get md5 hash of the image
      const md5Hash = await this.$utils.getFileHash(path, 'md5')
      const hashName = md5Hash + fileExt
      const thumbPath = `${this.appPaths.storageDirectories.appStorageNavigatorThumbs}/400-${hashName}`.replace(/\\/g, '/')

      // Check if thumb already exist
      if (fs.existsSync(thumbPath)) {
        this.appendThumb(target, thumbPath)
      }
      else {
        this.generateImageThumb(path, thumbPath, target)
      }
    },
    createElement (elementType, target, path) {
      let element
      if (elementType === 'image') {
        element = new Image()
        element.setAttribute('src', this.$storeUtils.getSafePath(this.$sharedUtils.getUrlSafePath(path)))
      }
      else if (elementType === 'video') {
        element = document.createElement('video')
        element.setAttribute('src', this.$storeUtils.getSafePath(this.$sharedUtils.getUrlSafePath(path)) + '#t=0.5')
      }
      element.classList.add('media-picker__item-thumb')
      element.classList.add('fade-in-1s')
      return element
    },
    appendThumb (target, thumbPath) {
      const image = this.createElement('image', target, thumbPath)
      // target.appendChild(image)
      // Try async image decoding method
      image.decode()
        .then(() => {
          // Remove previous thumb
          while (target.hasChildNodes()) {
            target.removeChild(target.lastChild)
          }
          // Append new thumb
          target.appendChild(image)
        })
        // Fallback to normal image decoding method
        .catch(() => {
          target.appendChild(image)
        })
    },
    async generateImageThumb (path, thumbPath, target) {
      const size = '400x?'
      ffmpeg.setFfmpegPath(this.appPaths.binFFMPEG)
      ffmpeg.setFfprobePath(this.appPaths.binFFPROBE)
      ffmpeg(path)
        .size(size)
        .on('error', (error) => {
          // console.log(error)
        })
        .on('end', () => {
          this.appendThumb(target, thumbPath)
        })
        .save(thumbPath)
    }
  }
}
</script>

<style>
.media-picker__container .progress {
  position: absolute;
}

.media-picker__container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-auto-rows: 128px;
  gap: 32px;
  margin-bottom: 32px;
}

.media-picker__item {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0px 8px 24px rgb(0, 0, 0, 0.4),
              0px 2px 4px rgb(0, 0, 0, 0.1);
}

.media-picker__item-thumb-container {
  width: 100%;
  height: 100%;
}

.media-picker__item img,
.media-picker__item video {
  position: relative;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-picker__item-icon-container {
  display: flex;
  position: absolute;
  bottom: 0;
  left: 0;
}

.v-btn.media-picker__item-icon--selected,
.v-btn.media-picker__item-icon--source-link,
.v-btn.media-picker__item-icon--support-link,
.v-btn.media-picker__item-icon--remove {
  z-index: 2;
  padding: 18px;
  transition: all 0.3s;
}

.v-btn.media-picker__item-icon--selected .v-icon,
.v-btn.media-picker__item-icon--source-link .v-icon,
.v-btn.media-picker__item-icon--support-link .v-icon,
.v-btn.media-picker__item-icon--remove .v-icon {
  color: var(--color-2) !important;
}

.v-btn.media-picker__item-icon--source-link,
.v-btn.media-picker__item-icon--support-link {
  opacity: 0;
}

.v-btn.media-picker__item-icon--remove {
  left: unset;
  right: 0;
  opacity: 0;
}

.media-picker__item:hover
  .media-picker__item-icon--remove {
    opacity: 1;
  }

.media-picker__item:hover
  .media-picker__item-icon--source-link,
.media-picker__item:hover
  .media-picker__item-icon--support-link {
    opacity: 1;
  }

.media-picker__item-overlay--description {
  z-index: 1;
  opacity: 0;
  position: absolute;
  width: 100%;
  height: 100%;
  bottom: 0;
  left: 0;
  padding: 0px 24px;
  background-color: rgb(81, 110, 176, 0.5);
  border: 2px solid rgb(255, 255, 255, 0.4);
  text-align: center;
  transition: opacity 0.25s;
}

.media-picker__item-overlay--description * {
  color: #fff;
}

.media-picker__item:hover .media-picker__item-overlay--description,
.media-picker__item[data-selected] .media-picker__item-overlay--description {
  opacity: 1;
  cursor: pointer;
}
</style>
