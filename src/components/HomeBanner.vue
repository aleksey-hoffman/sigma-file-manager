<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    class="media-banner"
    v-if="homeBannerValue"
    :show-background="homeBannerValue"
    :style="
      `height: ${homeBannerHeight + 'vh' || '50vh'}`
    "
  >
    <div 
      class="media-banner__media-container" 
      @click="handleClickDinoGameButton()"
    ></div>

    <!-- home-banner::color-gradient-overlay -->
    <div
      class="media-banner__overlay"
      v-if="homeBannerOverlaySelectedItem.name === 'colorGradient'"
      :style="`background: ${homeBannerSelectedOverlay}`"
      position="full"
    ></div>

    <!-- home-banner::bottom-overlay-fade-overlay -->
    <div
      class="media-banner__overlay"
      position="top"
      :overlayType="homeBannerOverlaySelectedItem.name"
      :style="{
        height: homeBannerOverlaySelectedItem.params &&
          homeBannerOverlaySelectedItem.params.topFadeHeight
      }"
    ></div>

    <!-- home-banner::bottom-overlay-fade-overlay -->
    <div
      class="media-banner__overlay"
      v-if="homeBannerOverlaySelectedItem.name === 'overlayFade'"
      @click="handleClickDinoGameButton()"
      position="bottom"
      :overlayType="homeBannerOverlaySelectedItem.name"
      :style="{
        height: homeBannerOverlaySelectedItem.params &&
          homeBannerOverlaySelectedItem.params.bottomFadeHeight
      }"
    ></div>

    <!-- home-banner::mask-fade-overlay -->
    <div
      class="media-banner__overlay"
      v-if="homeBannerOverlaySelectedItem.name === 'maskFade'"
      @click="handleClickDinoGameButton()"
      position="bottom"
      :overlayType="homeBannerOverlaySelectedItem.name"
      :style="{
        height: homeBannerOverlaySelectedItem.params &&
          homeBannerOverlaySelectedItem.params.bottomMaskHeight
      }"
    ></div>

    <!-- home-banner::bottom-actions-container -->
    <v-layout align-center class="media-banner__inner__container--left">
      <div class="mr-2 media-banner__title fade-in-1s">
        {{$t('pages.home')}}
      </div>

      <HomeBannerMenu />
      <AppButton
        button-class="home-banner__icon fade-in-1s"
        icon="mdi-autorenew"
        icon-size="20px"
        icon-class="action-toolbar__icon"
        :icon-props="{'home-banner-value': homeBannerValue}"
        :tooltip="$t('home.setNextBackground')"
        :tooltip-shortcuts="[
          {
            value: 'Alt',
            description: $t('home.setPreviousBackground')
          }
        ]"
        @click="switchBannerBackground"
      />

      <v-tooltip right>
        <template v-slot:activator="{on: tooltip}">
          <transition name="fade-in-1s">
            <v-btn
              class="action-toolbar__item fade-in-1s mt-1"
              v-on="tooltip"
              @click="$store.dispatch('SET_NEXT_HOME_BANNER_BACKGROUND')"
              icon
            >
              <v-icon
                size="20px"
                class="action-toolbar__icon"
                :home-banner-value="homeBannerValue"
              >mdi-autorenew
              </v-icon>
            </v-btn>
          </transition>
        </template>
        <span>Set next background</span>
      </v-tooltip>
    </v-layout>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import {mapGetters} from 'vuex'
import HomeBannerMenu from '@/components/HomeBannerMenu.vue'
import AppButton from '@/components/AppButton/AppButton.vue'

const electron = require('electron')

export default {
  components: {
    HomeBannerMenu,
    AppButton,
  },
  props: {
    setHomeBannerIsOffscreen: Function
  },
  mounted () {
    this.setBannerMedia()
    this.setHomeBannerIsOffscreen()
  },
  activated () {
    this.setBannerMedia()
  },
  watch: {
    displayGlowEffect () {
      this.setBannerMedia()
    },
    'homeBannerSelectedMedia.path' () {
      this.setBannerMedia()
    },
    'homeBannerOverlaySelectedItem.name' () {
      this.setBannerMedia()
    },
    'homeBannerSelectedMedia.positionX' () {
      this.setBannerMedia()
      this.setBannerMediaPosition()
    },
    'homeBannerSelectedMedia.positionY' () {
      this.setBannerMedia()
      this.setBannerMediaPosition()
    },
    'homeBannerValue' () {
      this.$nextTick(() => {
        this.setBannerMedia()
      })
    }
  },
  computed: {
    ...mapGetters([
      'homeBannerSelectedMedia',
      'homeBannerSelectedOverlay'
    ]),
    ...mapFields({
      inputState: 'inputState',
      homeBannerValue: 'storageData.settings.homeBanner.value',
      homeBannerHeight: 'storageData.settings.homeBanner.height',
      homeBannerOverlaySelectedItem: 'storageData.settings.homeBanner.overlay.selectedItem',
      homeBannerMediaGlowEffectValue: 'storageData.settings.visualEffects.homeBannerMediaGlowEffect.value',
    }),
    displayGlowEffect () {
      return this.homeBannerOverlaySelectedItem.name !== 'maskFade' && 
        this.homeBannerMediaGlowEffectValue
    }
  },
  methods: {
    switchBannerBackground () {
      if (this.inputState.alt) {
        this.$store.dispatch('setPreviousHomeBannerBackground')
      }
      else {
        this.$store.dispatch('setNextHomeBannerBackground')
      }
    },
    async setBannerMedia () {
      let type = this.homeBannerSelectedMedia.type
      let mediaContainerNode = document.querySelector('.media-banner__media-container')
      if (!mediaContainerNode) {return}

      this.$utils.clearHtmlContainer(mediaContainerNode)
      
      if (type === 'image') {
        let mediaNode = new Image()
        this.setImageMedia(mediaNode)
        this.setImageGlowMedia()
      }
      else if (type === 'video') {
        let mediaNode = document.createElement('video')
        this.setVideoMedia(mediaNode)
        this.setVideoGlowMedia()
      }
    },
    appendMedia (mediaNode, options = {}) {
      let mediaContainerNode = document.querySelector('.media-banner__media-container')
      mediaContainerNode?.appendChild(mediaNode)
      
      mediaNode.style.opacity = '0'
      mediaNode.style.objectPosition = '50% 50%'

      this.$nextTick(() => {
        mediaNode.animate(
          [
            { 
              objectPosition: `50% 50%`
            },
            { 
              objectPosition: `
                ${this.homeBannerSelectedMedia.positionX}% 
                ${this.homeBannerSelectedMedia.positionY}%
              ` 
            }
          ],
          {
            easing: 'ease',
            duration: 2000,
            fill: 'forwards'
          }
        )
        mediaNode.animate(
          [
            { 
              opacity: options.opacityStart ? options.opacityStart : 0, 
            },
            { 
              opacity: options.opacityEnd ? options.opacityEnd : 1, 
            }
          ],
          {
            easing: 'ease',
            duration: 1000,
            fill: 'forwards'
          }
        )
      })
    },
    setBannerMediaPosition () {
      let mediaItemNode = document.querySelector('.media-banner__media-item')
      if (!mediaItemNode) {return}

      mediaItemNode.style.setProperty(
        'object-position',
        `${this.homeBannerSelectedMedia.positionX}% ${this.homeBannerSelectedMedia.positionY}%`
      )
    },
    setImageMedia (mediaNode) {
      mediaNode.src = this.$storeUtils.getSafePath(this.homeBannerSelectedMedia.path)
      mediaNode.classList.add('media-banner__media-item')
      this.appendMedia(mediaNode)
    },
    setVideoMedia (mediaNode) {
      mediaNode.src = this.$storeUtils.getSafePath(this.homeBannerSelectedMedia.path)
      mediaNode.classList.add('media-banner__media-item')
      mediaNode.setAttribute('autoplay', true)
      mediaNode.setAttribute('loop', true)
      mediaNode.setAttribute('muted', true)
      this.appendMedia(mediaNode)
    },
    setImageGlowMedia () {
      if (!this.displayGlowEffect) {return}

      let mediaGlowNode = new Image()
      mediaGlowNode.src = this.$storeUtils.getSafePath(this.homeBannerSelectedMedia.path)
      mediaGlowNode.classList.add('media-banner__media-item-glow')
      this.appendMedia(mediaGlowNode, {opacityEnd: 0.3})
    },
    setVideoGlowMedia () {
      if (!this.displayGlowEffect) {return}

      let mediaGlowNode = document.createElement('video')
      mediaGlowNode.classList.add('media-banner__media-item-glow')
      mediaGlowNode.src = this.$storeUtils.getSafePath(this.homeBannerSelectedMedia.path)
      mediaGlowNode.setAttribute('autoplay', true)
      mediaGlowNode.setAttribute('loop', true)
      mediaGlowNode.setAttribute('muted', true)
      this.appendMedia(mediaGlowNode, {opacityEnd: 0.3})
    },
    handleClickDinoGameButton () {
      if (this.homeBannerSelectedMedia.fileNameBase === 'Land before Wi-Fi by Dana Franklin.jpg') {
        electron.ipcRenderer.send('open-hidden-game')
      }
    }
  }
}
</script>

<style>
.media-banner__media-container {
  width: 100%;
  height: 100%;
}

.media-banner[show-background="true"] {
  position: relative;
  text-align: center;
  color: #fff;
  background: var(--bg-color-2);
  /*
  * Fix for height value rounding error which
  * moves the overlay 1px up and causes a
  * transparent row of pixels on some window heights
  */
  margin-top: -1px;
}

.media-banner
  img,
.media-banner
  video {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    object-fit: cover;
    pointer-events: none;
    z-index: 0;
    transition: 
      object-position 2s ease, 
      transform 3s cubic-bezier(0.1, 1, 0.35, 1);
  }

.media-banner__title {
  font-size: 24px;
  color: var(--color-4);
}

.media-banner__inner__container--left {
  position: absolute;
  bottom: 8px;
  left: 16px;
  z-index: 3;
}

[show-background="true"]
  .media-banner__overlay {
    position: absolute;
    top: 0px;
    left: 0px;
    width: 100%;
    height: 100%;
  }

[show-background="true"]
  .media-banner__overlay[position="top"][overlayType="overlayFade"],
[show-background="true"]
  .media-banner__overlay[position="top"][overlayType="maskFade"] {
    height: 128px;
    background: linear-gradient(
      to top,
      hsla(0, 0%, 0%, 0) 0%,
      hsla(0, 0%, 0%, 0.013) 8.1%,
      hsla(0, 0%, 0%, 0.049) 15.5%,
      hsla(0, 0%, 0%, 0.104) 22.5%,
      hsla(0, 0%, 0%, 0.175) 29%,
      hsla(0, 0%, 0%, 0.259) 35.3%,
      hsla(0, 0%, 0%, 0.352) 41.2%,
      hsla(0, 0%, 0%, 0.45) 47.1%,
      hsla(0, 0%, 0%, 0.55) 52.9%,
      hsla(0, 0%, 0%, 0.648) 58.8%,
      hsla(0, 0%, 0%, 0.741) 64.7%,
      hsla(0, 0%, 0%, 0.825) 71%,
      hsla(0, 0%, 0%, 0.896) 77.5%,
      hsla(0, 0%, 0%, 0.951) 84.5%,
      hsla(0, 0%, 0%, 0.987) 91.9%,
      hsl(0, 0%, 0%) 100%
    );
    opacity: 0.4;
  }

[show-background="true"]
  .media-banner__overlay[position="bottom"][overlayType="overlayFade"] {
    top: unset;
    bottom: 0px;
    height: 128px;
    background: linear-gradient(
      to bottom,
      hsla(0, 0%, 0%, 0) 0%,
      hsla(0, 0%, 0%, 0.013) 8.1%,
      hsla(0, 0%, 0%, 0.049) 15.5%,
      hsla(0, 0%, 0%, 0.104) 22.5%,
      hsla(0, 0%, 0%, 0.175) 29%,
      hsla(0, 0%, 0%, 0.259) 35.3%,
      hsla(0, 0%, 0%, 0.352) 41.2%,
      hsla(0, 0%, 0%, 0.45) 47.1%,
      hsla(0, 0%, 0%, 0.55) 52.9%,
      hsla(0, 0%, 0%, 0.648) 58.8%,
      hsla(0, 0%, 0%, 0.741) 64.7%,
      hsla(0, 0%, 0%, 0.825) 71%,
      hsla(0, 0%, 0%, 0.896) 77.5%,
      hsla(0, 0%, 0%, 0.951) 84.5%,
      hsla(0, 0%, 0%, 0.987) 91.9%,
      hsl(0, 0%, 0%) 100%
    );
    opacity: 0.4;
  }

[show-background="true"]
  .media-banner__overlay[position="bottom"][overlayType="maskFade"] {
    top: unset;
    bottom: 0px;
    background: linear-gradient(
      to bottom,
      hsla(225, 12%, 13%, 0) 0%,
      hsla(225, 12%, 13%, 0.013) 8.1%,
      hsla(225, 12%, 13%, 0.049) 15.5%,
      hsla(225, 12%, 13%, 0.104) 22.5%,
      hsla(225, 12%, 13%, 0.175) 29%,
      hsla(225, 12%, 13%, 0.259) 35.3%,
      hsla(225, 12%, 13%, 0.352) 41.2%,
      hsla(225, 12%, 13%, 0.45) 47.1%,
      hsla(225, 12%, 13%, 0.55) 52.9%,
      hsla(225, 12%, 13%, 0.648) 58.8%,
      hsla(225, 12%, 13%, 0.741) 64.7%,
      hsla(225, 12%, 13%, 0.825) 71%,
      hsla(225, 12%, 13%, 0.896) 77.5%,
      hsla(225, 12%, 13%, 0.951) 84.5%,
      hsla(225, 12%, 13%, 0.987) 91.9%,
      hsl(225, 12%, 13%) 100%
    );
  }

.media-banner__media-item-glow {
  top: 28px !important;
  z-index: -1 !important;
  box-shadow: none !important;
  opacity: 0.3;
}

</style>