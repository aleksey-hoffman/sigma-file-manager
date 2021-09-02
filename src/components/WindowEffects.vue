<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div v-if="windowTransparencyEffect.value">
    <img
      class="overlay--window-transparency-effect__media" 
      v-if="windowTransparencyEffect.data.background.selected.type === 'image'"
      :src="$storeUtils.getSafePath(windowTransparencyEffect.data.background.selected.path)"
      :style="{
        'filter': `blur(${windowTransparencyEffect.blur}px)`,
        'opacity': windowTransparencyEffect.opacity / 100
      }"
    >
    <video
      class="overlay--window-transparency-effect__media" 
      v-if="windowTransparencyEffect.data.background.selected.type === 'video'"
      :src="$storeUtils.getSafePath(windowTransparencyEffect.data.background.selected.path)"
      :style="{
        'filter': `blur(${windowTransparencyEffect.blur}px)`,
        'opacity': windowTransparencyEffect.opacity / 100
      }"
      autoplay loop muted
    />
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import TimeUtils from '../utils/timeUtils.js'

const electron = require('electron')
const currentWindow = require('@electron/remote').getCurrentWindow()

export default {
  data () {
    return {
      mediaNode: null,
      transformThrottle: null
    }
  },
  created () {
    this.initIPCListeners()
  },
  mounted () {
    this.initMediaTransform()
  },
  watch: {
    'windowTransparencyEffect.data.background.selected.path' () {
      this.$nextTick(() => {
        this.setMediaNode()
      })
    },
    'windowTransparencyEffect.value' () {
      this.$nextTick(() => {
        this.setMediaNode()
      })
    },
    'UIZoomLevel' () {
      this.transformMedia()
    }
  },
  computed: {
    ...mapFields({
      windowTransparencyEffect: 'storageData.settings.windowTransparencyEffect',
      UIZoomLevel: 'storageData.settings.UIZoomLevel',
    })
  },
  methods: {
    initIPCListeners () {
      electron.ipcRenderer.on('main-window-move', (event, data) => {
        this.handleWindowTransform()
      })
    },
    initMediaTransform () {
      // TODO: move to main process or to another thread to improve performance
      this.transformThrottle = new TimeUtils()
      this.setMediaNode()
    },
    handleWindowTransform () {
      if (this.mediaNode) {
        this.transformThrottle.throttle(this.transformMedia, {
          time: 10
        })
      }
    },
    setMediaNode () {
      this.mediaNode = document.querySelector('.overlay--window-transparency-effect__media')
      // TODO: move appStorage getter to main process to avoid this:
      // Set media position with a delay,
      // in case appStorage files are still loading 
      setTimeout(() => {
        this.transformMedia()
      }, 1000)
    },
    transformMedia (windowPoosition) {
      if (this.mediaNode) {
        this.mediaNode.width = window.screen.width / electron.webFrame.getZoomFactor()
        this.mediaNode.height = window.screen.height / electron.webFrame.getZoomFactor()

        if (this.windowTransparencyEffect.parallaxDistance > 0) {
          let [winX, winY] = currentWindow.getPosition()
          let newXposition = -(winX / window.screen.width * 100 / this.windowTransparencyEffect.parallaxDistance)
          let newYposition = -(winY / window.screen.height * 100 / this.windowTransparencyEffect.parallaxDistance)
          this.mediaNode.style.transform = `translate(${newXposition}%, ${newYposition}%)`
        }
      }
    }
  }
}
</script>

<style>
.overlay--window-transparency-effect__media {
  z-index: 900;
  user-select: none;
  pointer-events: none;
  position: fixed;
  object-fit: cover;
  filter: blur(56px);
  opacity: 0.1;
  transition: transform 0.1s;
}
</style>