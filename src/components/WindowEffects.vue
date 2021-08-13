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
const currentWindow = electron.remote.getCurrentWindow()

export default {
  data () {
    return {
      mediaNode: null,
      transformThrottle: null
    }
  },
  mounted() {
    this.initMediaTransform()
  },
  watch: {
    'windowTransparencyEffect.data.background.selected.path' () {
      this.$nextTick(() => {
        this.setMediaNode()
      })
    }
  },
  computed: {
    ...mapFields({
      windowTransparencyEffect: 'storageData.settings.windowTransparencyEffect',
    })
  },
  methods: {
    initMediaTransform () {
      // TODO: move to main process or to another thread to improve performance
      this.transformThrottle = new TimeUtils()
      this.setMediaNode()
      currentWindow.on('move', this.handleWindowMove)
    },
    handleWindowMove () {
      if (this.mediaNode) {
        this.transformThrottle.throttle(this.transformMedia, {
          time: 10
        })
      }
    },
    setMediaNode () {
      this.mediaNode = document.querySelector('.overlay--window-transparency-effect__media')
    },
    transformMedia () {
      let [winX, winY] = currentWindow.getPosition()
      let newXposition = -(winX / 1920 * 100)
      let newYposition = -(winY / 1080 * 100)
      this.mediaNode.style.transform = `translate(${newXposition}%, ${newYposition}%)`
    }
  }
}
</script>

<style>
.overlay--window-transparency-effect__media {
  z-index: 1000;
  user-select: none;
  pointer-events: none;
  position: fixed;
  width: 1920px;
  height: 1080px;
  object-fit: cover;
  filter: blur(56px);
  opacity: 0.1;
  transition: transform 0.1s;
}
</style>