<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div v-show="windowTransparencyEffect.value">
    <img
      v-if="currentPageEffects.windowTransparencyEffect.background.type === 'image'"
      class="overlay--window-transparency-effect__media"
      :src="$storeUtils.getSafePath(currentPageEffects.windowTransparencyEffect.background.path)"
    />
    <video
      v-if="currentPageEffects.windowTransparencyEffect.background.type === 'video'"
      class="overlay--window-transparency-effect__media"
      :src="$storeUtils.getSafePath(currentPageEffects.windowTransparencyEffect.background.path)"
      autoplay
      loop
      muted
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
      transformThrottle: null,
    }
  },
  created () {
    this.initIPCListeners()
  },
  mounted () {
    this.initMediaTransform()
    this.setOverlayCSS()
    setTimeout(() => {
      this.setOverlayCSS()
    }, 1000)
  },
  watch: {
    'windowTransparencyEffect.options.selectedPage.background.path' () {
      this.$nextTick(() => {
        this.setMediaNode()
      })
    },
    'windowTransparencyEffect.value' () {
      this.$nextTick(() => {
        this.setMediaNode()
      })
    },
    UIZoomLevel () {
      this.transformMedia()
    },
    'currentPageEffects.windowTransparencyEffect.blur' () {
      this.setOverlayCSS()
    },
    'currentPageEffects.windowTransparencyEffect.opacity' () {
      this.setOverlayCSS()
    },
    themeType () {
      this.setOverlayCSS()
    },
    visualFiltersApplyFiltersToMediaElements () {
      this.setOverlayCSS()
    },
    visualFiltersContrastValue () {
      this.setOverlayCSS()
    },
    visualFiltersBrightnessValue () {
      this.setOverlayCSS()
    },
    visualFiltersSaturationValue () {
      this.setOverlayCSS()
    },
    windowTransparencyEffectDataBackgroundSelected () {
      this.$nextTick(() => {
        this.setOverlayCSS()
      })
    },
  },
  computed: {
    ...mapFields({
      windowTransparencyEffect: 'storageData.settings.windowTransparencyEffect',
      windowTransparencyEffectSameSettingsOnAllPages: 'storageData.settings.windowTransparencyEffect.sameSettingsOnAllPages',
      windowTransparencyEffectLessProminentOnHomePage: 'storageData.settings.windowTransparencyEffect.lessProminentOnHomePage',
      windowTransparencyEffectPreviewEffect: 'storageData.settings.windowTransparencyEffect.previewEffect',
      windowTransparencyEffectOptionsSelectedPage: 'storageData.settings.windowTransparencyEffect.options.selectedPage',
      windowTransparencyEffectOptionsPages: 'storageData.settings.windowTransparencyEffect.options.pages',
      windowTransparencyEffectBlur: 'storageData.settings.windowTransparencyEffect.options.selectedPage.blur',
      windowTransparencyEffectOpacity: 'storageData.settings.windowTransparencyEffect.options.selectedPage.opacity',
      windowTransparencyEffectDataBackgroundSelected: 'storageData.settings.windowTransparencyEffect.options.selectedPage.background',
      UIZoomLevel: 'storageData.settings.UIZoomLevel',
      themeType: 'storageData.settings.theme.type',
      visualFiltersApplyFiltersToMediaElements: 'storageData.settings.visualFilters.applyFiltersToMediaElements',
      visualFiltersContrastValue: 'storageData.settings.visualFilters.contrast.value',
      visualFiltersBrightnessValue: 'storageData.settings.visualFilters.brightness.value',
      visualFiltersSaturationValue: 'storageData.settings.visualFilters.saturation.value',
    }),
    currentPageEffects () {
      try {
        if (this.windowTransparencyEffectLessProminentOnHomePage && this.$route.name === 'home') {
          let globalWindowTransparencyOptionsClone = this.$utils.cloneDeep(this.globalWindowTransparencyOptions)
          globalWindowTransparencyOptionsClone.opacity = 5
          globalWindowTransparencyOptionsClone.blur = 32
          return {
            windowTransparencyEffect: globalWindowTransparencyOptionsClone,
          }
        }
        else if (this.windowTransparencyEffectPreviewEffect && this.$route.name === 'settings') {
          return {
            windowTransparencyEffect: this.windowTransparencyEffectOptionsSelectedPage,
          }
        }
        else {
          if (this.windowTransparencyEffectSameSettingsOnAllPages) {
            return {
              windowTransparencyEffect: this.globalWindowTransparencyOptions,
            }
          }
          else {
            return {
              windowTransparencyEffect: this.currentPageWindowTransparencyOptions,
            }
          }
        }
      }
      catch (error) {
        return {
          windowTransparencyEffect: this.windowTransparencyEffectOptionsSelectedPage,
        }
      }
    },
    globalWindowTransparencyOptions () {
      return this.windowTransparencyEffectOptionsPages.find(page => {
        return page.name === ''
      })
    },
    currentPageWindowTransparencyOptions () {
      return this.windowTransparencyEffectOptionsPages.find(page => {
        return page.name === this.$route.name
      })
    },
  },
  methods: {
    setOverlayCSS () {
      let overlayNode = document.querySelector('.overlay--window-transparency-effect__media')
      let blur = `${this.currentPageEffects.windowTransparencyEffect.blur}px`
      let opacity = this.currentPageEffects.windowTransparencyEffect.opacity / 100
      let invertInverse = this.themeType === 'light-filter' ? 1 : 0
      let hueRotateInverse = this.themeType === 'light-filter' ? '180deg' : '0deg'
      let contrastInverse = this.visualFiltersApplyFiltersToMediaElements
        ? this.visualFiltersContrastValue
        : 1 + (1 - this.visualFiltersContrastValue)
      let brightnessInverse = this.visualFiltersApplyFiltersToMediaElements
        ? this.visualFiltersBrightnessValue
        : 1 + (1 - this.visualFiltersBrightnessValue)
      let saturationInverse = this.visualFiltersApplyFiltersToMediaElements
        ? this.visualFiltersSaturationValue
        : 1 + (1 - this.visualFiltersSaturationValue)

      overlayNode.style.setProperty('--blur', blur)
      overlayNode.style.setProperty('--visual-filter-invert-inverse', invertInverse)
      overlayNode.style.setProperty('--visual-filter-hue-rotate-inverse', hueRotateInverse)
      overlayNode.style.setProperty('--visual-filter-contrast-inverse', contrastInverse)
      overlayNode.style.setProperty('--visual-filter-brightness-inverse', brightnessInverse)
      overlayNode.style.setProperty('--visual-filter-saturation-inverse', saturationInverse)
      overlayNode.style.opacity = opacity
    },
    initIPCListeners () {
      electron.ipcRenderer.on('main-window-move', (event, data) => {
        this.handleWindowTransform()
      })
    },
    initMediaTransform () {
      // TODO: move to main process or to another thread to improve performance
      this.transformThrottle = new TimeUtils()
      // TODO: move appStorage getter to main process to avoid this:
      // Set media position with a delay,
      // in case appStorage files are still loading
      setTimeout(() => {
        this.setMediaNode()
      }, 1000)
    },
    handleWindowTransform () {
      if (this.mediaNode) {
        this.transformThrottle.throttle(this.transformMedia, {
          time: 10,
        })
      }
    },
    setMediaNode () {
      this.mediaNode = document.querySelector('.overlay--window-transparency-effect__media')
      this.transformMedia()
    },
    transformMedia () {
      if (this.mediaNode) {
        this.mediaNode.width = window.screen.width / electron.webFrame.getZoomFactor()
        this.mediaNode.height = window.screen.height / electron.webFrame.getZoomFactor()

        if (this.currentPageEffects.windowTransparencyEffect.parallaxDistance > 0) {
          let [winX, winY] = currentWindow.getPosition()
          let newXposition = -(((winX / window.screen.width) * 100) / this.currentPageEffects.windowTransparencyEffect.parallaxDistance)
          let newYposition = -(((winY / window.screen.height) * 100) / this.currentPageEffects.windowTransparencyEffect.parallaxDistance)
          this.mediaNode.style.transform = `translate(${newXposition}%, ${newYposition}%)`
        }
      }
    },
  },
}
</script>

<style>
.overlay--window-transparency-effect__media {
  z-index: 900;
  user-select: none;
  pointer-events: none;
  position: fixed;
  object-fit: cover;
  filter:
    blur(var(--blur))
    invert(var(--visual-filter-invert-inverse))
    hue-rotate(var(--visual-filter-hue-rotate-inverse))
    contrast(var(--visual-filter-contrast-inverse))
    brightness(var(--visual-filter-brightness-inverse))
    saturate(var(--visual-filter-saturation-inverse));
  opacity: 0.1;
  transition: transform 0.1s;
}
</style>
