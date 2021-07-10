<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div id="home-route" class="main-content-container">
    <overlay-scrollbars
      id="content-area--home-route"
      class="content-area fade-mask--bottom"
      ref='contentAreaHomeRoute'
      :data-show-background="homeBannerValue"
      :options="{
        className: 'os-theme-minimal-light',
        scrollbars: {
          autoHide: 'move'
        },
        callbacks : {
          onScroll: watchContentAreaScroll
        }
      }"
      :style="{
        '--fade-mask-bottom': '6%'
      }"
    >
      <!-- home-banner -->
      <div
        v-show="homeBannerValue"
        class="media-banner"
        :data-show-background="homeBannerValue"
        :style="
          `height: ${homeBannerHeight + 'vh' || '50vh'}`
        "
      >
        <!-- home-banner::image -->
        <img
          v-if="homeBannerSelectedMedia.type === 'image'"
          :style="{
            'object-position': `${homeBannerSelectedMedia.positionX}% ${homeBannerSelectedMedia.positionY}%`
          }"
          :src="$storeUtils.getSafePath(homeBannerSelectedMedia.path)"
        />

        <button
          class="hidden-game-button"
          tabindex="-1"
          focusable="false"
          @click="handleClickHiddenButton(homeBannerSelectedMedia)"
        ></button>

        <!-- home-banner::video -->
        <video
          v-if="homeBannerSelectedMedia.type === 'video'"
          id="media-banner__video"
          :style="{
            'object-position': `${homeBannerSelectedMedia.positionX}% ${homeBannerSelectedMedia.positionY}%`
          }"
          :src="$storeUtils.getSafePath(homeBannerSelectedMedia.path)"
          autoplay loop muted
        />

        <!-- home-banner::color-gradient-overlay -->
        <div
          v-if="homeBannerOverlaySelectedItem.name === 'colorGradient'"
          class="media-banner__overlay"
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
          v-if="homeBannerOverlaySelectedItem.name === 'overlayFade'"
          class="media-banner__overlay"
          position="bottom"
          :overlayType="homeBannerOverlaySelectedItem.name"
          :style="{
            height: homeBannerOverlaySelectedItem.params &&
              homeBannerOverlaySelectedItem.params.bottomFadeHeight
          }"
        ></div>

        <!-- home-banner::mask-fade-overlay -->
        <div
          v-if="homeBannerOverlaySelectedItem.name === 'maskFade'"
          class="media-banner__overlay"
          position="bottom"
          :overlayType="homeBannerOverlaySelectedItem.name"
          :style="{
            height: homeBannerOverlaySelectedItem.params &&
              homeBannerOverlaySelectedItem.params.bottomMaskHeight
          }"
        ></div>

        <!-- home-banner::bottom-actions-container -->
        <v-layout align-center class="px-2 __container--left">
          <div class="mr-2 media-banner__title fade-in-1s">
            {{$localize.get('page_home_title')}}
          </div>
          <home-banner-menu/>

          <v-tooltip right>
            <template v-slot:activator="{ on: tooltip }">
              <transition name="fade-in-1s">
                <v-btn
                  v-on="tooltip"
                  @click="$store.dispatch('SET_NEXT_HOME_BANNER_BACKGROUND')"
                  icon
                  class="action-toolbar__item fade-in-1s mt-1"
                >
                  <v-icon
                    size="20px"
                    class="action-toolbar__icon"
                    :data-home-banner-value="homeBannerValue"
                  >mdi-autorenew
                  </v-icon>
                </v-btn>
              </transition>
            </template>
            <span>Set next background</span>
          </v-tooltip>
        </v-layout>
      </div>

      <!-- content-area -->
      <div id="home-route__content-area--main" class="content-area__main">
        <div v-show="!homeBannerValue" class="text--title-1">
          {{$localize.get('page_home_title')}}
        </div>

        <!-- title:system-dirs -->
        <div class="text--sub-title-1 mb-3 mt-0">
          {{$localize.get('text_system_directories')}}
        </div>

        <div class="content-area__section">
          <basic-item-card-iterator
            :items="userDirs"
            category="userDir"
            type="userDir"
          ></basic-item-card-iterator>
        </div>

        <!-- title:dirves -->
        <div class="text--sub-title-1 mb-3">
          {{$localize.get('text_drives')}}
        </div>

        <!-- Note: render only on 'Home' route, otherwise will get:
        RangeError: Maximum call stack size exceeded -->
        <div
          v-if="$route.name === 'home'"
          class="content-area--home-route__section"
        >
          <drive-cards-iterator/>
        </div>
      </div>
    </overlay-scrollbars>
  </div>
</template>

<script>
import { mapFields } from 'vuex-map-fields'
import { mapGetters, mapState } from 'vuex'

const electron = require('electron')

export default {
  name: 'home',
  data () {
    return {
    }
  },
  beforeRouteLeave (to, from, next) {
    this.$eventHub.$emit('app:method', {
      method: 'setRouteScrollPosition',
      params: {
        toRoute: to,
        fromRoute: from
      }
    })
    next()
  },
  activated () {
    const video = document.querySelector('#media-banner__video')
    const videoGlow = document.querySelector('#media-banner__glow')
    if (video) { video.play() }
    if (videoGlow) { videoGlow.play() }
  },
  mounted () {
    this.$store.dispatch('ROUTE_MOUNTED_HOOK_CALLBACK', {
      route: 'home'
    })
    this.setHomeBannerIsOffscreen()
  },
  computed: {
    ...mapGetters([
      'systemInfo',
      'homeBannerSelectedMedia',
      'homeBannerSelectedOverlay'
    ]),
    ...mapState({
      currentDir: state => state.navigatorView.currentDir,
      homeBannerItems: state => state.storageData.settings.homeBanner.items
    }),
    ...mapFields({
      appPaths: 'appPaths',
      windowSize: 'windowSize',
      userDirs: 'appPaths.userDirs',
      homeBannerIsOffscreen: 'homeBannerIsOffscreen',
      homeBannerValue: 'storageData.settings.homeBanner.value',
      homeBannerHeight: 'storageData.settings.homeBanner.height',
      homeBannerOverlaySelectedItem: 'storageData.settings.homeBanner.overlay.selectedItem'
    })
  },
  methods: {
    watchContentAreaScroll () {
      this.setHomeBannerIsOffscreen()
    },
    setHomeBannerIsOffscreen () {
      const container = this.$refs.contentAreaHomeRoute
      const scrollContainer = container.$el.querySelector('.os-viewport')
      const containerScrollTop = scrollContainer.scrollTop
      const clientHeight = scrollContainer.clientHeight
      const bannerHeightPerc = 0.5
      const offscreenOffset = 72
      const bannerSize = clientHeight * bannerHeightPerc
      const bannerIsAlmostOffScreen = bannerSize - containerScrollTop <= offscreenOffset
      this.homeBannerIsOffscreen = !bannerIsAlmostOffScreen
    },
    handleClickHiddenButton (homeBannerSelectedMedia) {
      const isDinoImage = homeBannerSelectedMedia.fileNameBase === 'Land before Wi-Fi by Dana Franklin.jpg'
      if (isDinoImage) {
        electron.ipcRenderer.send('open-hidden-game')
      }
    }
  }
}
</script>

<style>
.action-toolbar__icon[data-home-banner-value] {
  color: var(--color-4) !important;
}

#home-route
  .content-area:not([data-show-background]) {
    padding: 0px;
    height: calc(
      100vh
      - var(--window-toolbar-height)
      - var(--action-toolbar-height)
    );
    overflow-y: overlay;
    user-select: none;
  }

#home-route
  .content-area[data-show-background] {
    padding: 0px;
    height: 100vh;
    margin-top: calc(-1 * var(--header-height));
    overflow-y: overlay;
    user-select: none;
  }

#home-route
  .content-area
    .content-area__main {
      padding: 8px 24px;
      user-select: none;
      background-color: rgba(29, 31, 37, 0);
    }

#home-route
  .content-area[data-show-background]
    .content-area__main {
      padding: 16px 24px;
      user-select: none;
      background-color: rgba(29, 31, 37, 0);
    }

#home-route
  .content-area__section {
    margin-top: 8px;
    margin-bottom: 16px;
  }

.media-banner[data-show-background="true"] {
  position: relative;
  overflow: hidden;
  /* height: 75vh; */
  text-align: center;
  color: #fff;
  background: var(--bg-color-2);
  /*
  * Fix for height value rounding error which
  * moves the overlay 1px up and show a
  * transparent row of pixels on some window heights
  */
  margin-top: -1px;
}

.media-banner
  img,
.media-banner
  video {
    position: relative;
    height: 100%;
    width: 100%;
    object-fit: cover;
    pointer-events: none;
    z-index: 0;
    transition: object-position 2s ease, transform 3s cubic-bezier(0.1, 1, 0.35, 1);
    transform: scale(1.2);
  }

.media-banner__title {
  font-size: 24px;
  color: var(--color-4);
}

.media-banner
  .__container--left {
    position: absolute;
    bottom: 8px;
    left: 16px;
    z-index: 3;
  }

[data-show-background="true"]
  .media-banner__overlay {
    position: absolute;
    top: 0px;
    left: 0px;
    width: 100%;
    height: 100%;
  }

[data-show-background="true"]
  .media-banner__overlay[position="top"]:not([overlayType="colorGradient"]):not([overlayType="none"]) {
    /* background-image: linear-gradient(180deg, rgb(0, 0, 0, 0.4) 0%, transparent 72px); */

    /* https://larsenwork.com/easing-gradients/ */
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

[data-show-background="true"]
  .media-banner__overlay[position="bottom"][overlayType="overlayFade"] {
    top: unset;
    /* NOTE: setting -1px to prevent 1px media bleed
    /* when window height is rounded to the wrong directon */
    bottom: 0px;
    /* bottom: -1px; */

    /* height: 128px;
    background: linear-gradient(
      0deg,
      rgba(var(--bg-color-2-value), 1) 0%,
      rgba(var(--bg-color-2-value), 0.85) 20%,
      transparent 128px
    ); */

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

[data-show-background="true"]
  .media-banner__overlay[position="bottom"][overlayType="maskFade"] {
    top: unset;
    /* NOTE: setting -1px to prevent 1px media bleed
    /* when window height is rounded to the wrong directon */
    bottom: 0px;
    /* bottom: -1px; */

    /* Mask fade type 1 */
    /* height: 128px;
    background: linear-gradient(
      0deg,
      rgba(var(--bg-color-2-value), 1) 0%,
      rgba(var(--bg-color-2-value), 0.85) 20%,
      transparent 128px
    ); */

    /* Mask fade type 2 */
    /* height: 200px; */
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

.hidden-game-button {
  position: absolute;
  left: 25vw;
  top: 10vh;
  background: transparent;
  width: 20vw;
  height: 35vh;
  min-width: 200px;
  min-height: 250px;
  cursor: default;
  user-select: none;
  z-index: 2;
}

.hidden-game-button:focus {
  outline: none;
}

@media (max-width: 500px) {
  .hidden-game-button {
    left: 15vw;
  }
}
</style>
