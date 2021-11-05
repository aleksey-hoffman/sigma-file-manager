<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-app-bar
    id="window-toolbar"
    :style="{'background': windowToolbarBackgroundColor}"
    app flat clipped-right clipped-left height="32px"
  >
    <div class="window-toolbar__drag-region"></div>
    <div class="window-toolbar__content-container">
      <div
        class="window-toolbar__header-container"
        @click="navigationPanelMiniVariant = !navigationPanelMiniVariant"
        :style="!navigationPanelMiniVariant 
          ? 'width: var(--nav-panel-width-expanded)' 
          : 'width: var(--nav-panel-width)'"
        v-ripple
        align-center
      >
        <div class="nav-panel__item__icon-container pl-1">
          <v-icon class="nav-panel__item__icon window-toolbar__item">
            mdi-menu
          </v-icon>
        </div>
        <transition name="slide-fade-left">
          <div v-if="!navigationPanelMiniVariant">
            <div class="nav-panel__item__title">
              Sigma file manager
            </div>
          </div>
        </transition>
      </div>

      <v-layout class="window-toolbar__content--main">

        <!-- item-iterator -->
        <div
          v-for="(item, index) in windowToolbar.items"
          :key="'window-toolbar-item-' + index"
          :class="{
            'window-toolbar__content--main__flex': item.type === 'spacer'
          }"
        >
          <template v-if="item.type === 'workspaces-menu'">
            <workspaces-menu :iconColor="windowToolbarFontColor"/>
          </template>
          <template v-if="item.type === 'tabs-menu'">
            <tabs-menu :iconColor="windowToolbarFontColor"/>
          </template>

          <template v-if="item.type === 'tabs-menu-add' && $route.name === 'navigator'">
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  class="window-toolbar__item"
                  v-on="on"
                  @click="$store.dispatch('ADD_TAB')"
                  icon
                >
                  <v-icon size="22px">
                    mdi-plus
                  </v-icon>
                </v-btn>
              </template>
              <span>New tab in current workspace</span>
            </v-tooltip>
          </template>

          <template v-if="item.type === 'notification-menu'">
            <notification-menu :iconColor="windowToolbarFontColor"/>
          </template>
          <template v-if="item.type === 'menu-button'">
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  class="window-toolbar__item"
                  v-on="on"
                  @click="item.onClick()"
                  icon
                >
                  <v-icon
                    :color="windowToolbarFontColor"
                    :size="item.icon.size"
                  >
                    {{item.icon.name}}
                  </v-icon>
                </v-btn>
              </template>
              <span>
                <div
                  class="tooltip__description"
                  v-html="item.tooltip.description"
                ></div>
                <div
                  class="tooltip__shortcut"
                  v-show="[undefined, true].includes(item.tooltip.shortutIfCondition)"
                  v-html="item.tooltip.shortcut"
                ></div>
              </span>
            </v-tooltip>
          </template>

          <template v-if="item.type === 'window-controls-group'">
            <div class="window-controls-group">
              <div 
                v-for="(item, index) in item.items"
                :key="'window-controls-group-item-' + index"
              >
                <v-tooltip bottom min-width="100px">
                  <template v-slot:activator="{ on }">
                    <button
                      class="window-toolbar__item window-controls-group__item"
                      v-on="on"
                      @click="item.onClick()"
                      icon
                    >
                      <v-icon
                        :color="windowToolbarFontColor"
                        :size="item.icon.size"
                      >
                        {{item.icon.name}}
                      </v-icon>
                    </button>
                  </template>
                  <span>
                    <div
                      class="tooltip__description"
                      v-html="item.tooltip.description"
                    ></div>
                    <div
                      class="tooltip__shortcut"
                      v-show="[undefined, true].includes(item.tooltip.shortutIfCondition)"
                      v-html="item.tooltip.shortcut"
                    ></div>
                  </span>
                </v-tooltip>
              </div>
            </div>
          </template>
        </div>
      </v-layout>
    </div>
  </v-app-bar>
</template>

<script>
import electron from 'electron'
import {mapFields} from 'vuex-map-fields'
import {mapGetters} from 'vuex'
const electronRemote = require('@electron/remote')

export default {
  data () {
    return {
      window: electronRemote.getCurrentWindow()
    }
  },
  computed: {
    ...mapGetters([
      'systemInfo',
      'windowToolbarFontColor'
    ]),
    ...mapFields({
      shortcuts: 'storageData.settings.shortcuts',
      dialogs: 'dialogs',
      homeBannerIsOffscreen: 'homeBannerIsOffscreen',
      navigationPanelMiniVariant: 'navigationPanel.miniVariant',
      homeBannerValue: 'storageData.settings.homeBanner.value',
      windowCloseButtonAction: 'storageData.settings.windowCloseButtonAction',
      homeBannerOverlaySelectedItem: 'storageData.settings.homeBanner.overlay.selectedItem'
    }),
    toolbarColor () { return this.$store.state.storageData.settings.theme.toolbarColor },
    windowToolbarFontColor () {
      // Force white icons on transparent toolbars
      if (this.toolbarIsTransparent) {
        if (this.homeBannerOverlaySelectedItem.name === 'none') {
          return this.$utils.getCSSVar('--color-2')
        }
        else {
          return this.$utils.getCSSVar('--color-4')
        }
      }
      else {
        return this.$store.getters.windowToolbarFontColor
      }
    },
    toolbarIsTransparent () {
      const routeIsHome = this.$route.name === 'home'
      const bannerIsShown = this.homeBannerValue
      return routeIsHome && bannerIsShown && this.homeBannerIsOffscreen
    },
    windowToolbarBackgroundColor () {
      return this.toolbarIsTransparent
        ? 'transparent'
        : this.toolbarColor
    },
    windowCloseButtonActionDescription () {
      if (this.windowCloseButtonAction === 'minimizeAppToTray') {
        return 'Minimize to tray and keep in memory'
      }
      else if (this.windowCloseButtonAction === 'closeMainWindow') {
        return 'Minimize to tray and minimize memory usage'
      }
      else if (this.windowCloseButtonAction === 'closeApp') {
        return 'Close the app'
      }
      else {
        return 'Close the app'
      }
    },
    windowToolbar () {
      return {
        items: [
           {
            type: 'menu-button',
            icon: {
              size: '18px',
              name: 'mdi-message-question-outline'
            },
            tooltip: {
              description: 'App guide'
            },
            onClick: () => {this.dialogs.guideDialog.value = true}
          },
          {
            type: 'workspaces-menu'
          },
          {
            type: 'tabs-menu'
          },
          {
            type: 'tabs-menu-add'
          },
          {
            type: 'spacer'
          },
          {
            type: 'notification-menu'
          },
          // TODO: finish in v1.X
          // {
          //   icon: {
          //     size: '18px',
          //     name: 'mdi-progress-clock'
          //   },
          //   tooltip: {
          //     description: 'Ongoing tasks',
          //     shortcut: undefined
          //   },
          //   onClick: () => undefined
          // },
          // {
          //   icon: {
          //     size: '18px',
          //     name: 'mdi-menu'
          //   },
          //   tooltip: {
          //     description: 'Window menu',
          //     shortcut: undefined
          //   },
          //   onClick: () => undefined
          // },
          {
            type: 'window-controls-group',
            items: [
              {
                type: 'window-controls',
                icon: {
                  size: '18px',
                  name: 'mdi-minus'
                },
                tooltip: {
                  description: 'Minimize window',
                  shortcut: this.shortcuts.toggleApp.shortcut
                },
                onClick: () => this.minimizeWindow()
              },
              {
                type: 'window-controls',
                icon: {
                  size: '16px',
                  name: 'mdi-aspect-ratio'
                },
                tooltip: {
                  description: 'Toggle window size',
                  shortcut: this.shortcuts.windowPosition.shortcut[this.systemInfo.platform]
                },
                onClick: () => this.maximizeWindow()
              },
              {
                type: 'window-controls',
                icon: {
                  size: '18px',
                  name: 'mdi-close'
                },
                tooltip: {
                  description: `
                    Close window:
                    <br>Action: ${this.windowCloseButtonActionDescription}
                  `,
                  shortcut: `
                    Toggle window: ${this.shortcuts.toggleApp.shortcut}
                  `,
                  shortutIfCondition: this.windowCloseButtonAction !== 'closeApp'
                },
                onClick: () => this.closeWindow()
              }
            ]
          },
        ]
      }
    }
  },
  methods: {
    minimizeWindow () {
      this.window.minimize()
    },
    maximizeWindow () {
      if (this.window.isMaximized()) {
        this.window.unmaximize()
      }
      else {
        this.window.maximize()
      }
    },
    closeWindow () {
      electron.ipcRenderer.send('handle:close-app', this.windowCloseButtonAction)
    }
  }
}
</script>

<style>
#window-toolbar {
  transition: background-color 0.1s;
  z-index: 10;
}

#window-toolbar
  .window-toolbar__content--main {
    display: flex;
    align-items: center;
    gap: var(--toolbar-item-gap);
    padding: 
      0px 
      var(--window-toolbar-padding-right) 
      0px 
      var(--window-toolbar-padding-left) !important;
  }

.window-toolbar__drag-region {
  top: 4px;
  left: 4px;
  display: block;
  position: absolute;
  width: calc(100% - 8px);
  height: calc(100% - 4px);
  z-index: -1;
  -webkit-app-region: drag;
}

#app[is-window-maximized]
  .window-toolbar__drag-region {
    top: 0;
    left: 0;
    width: 100%;
    height: var(--window-toolbar-height);
  }

.window-toolbar__content-container {
  display: flex;
  align-items: center;
  width: auto;
  min-width: 100%;
}

.window-toolbar__content--main__flex {
  height: calc(var(--window-toolbar-height) - 8px);
  width: -webkit-fill-available;
  -webkit-app-region: drag;
}

#app[is-window-maximized] 
  .window-toolbar__content--main__flex {
    height: var(--window-toolbar-height);
  }

.window-toolbar__header-container {
  display: grid !important;
  align-items: center;
  grid-template-columns:
    calc(
      var(--nav-panel-active-indicator-width) +
      var(--nav-panel-icon-width)
    )
    1fr;
  grid-auto-rows: var(--window-toolbar-height);
  cursor: pointer;
  user-select: none;
}

.window-toolbar__item {
  -webkit-app-region: no-drag;
  user-select: none;
}

.window-controls-group {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: calc(-1 * var(--window-toolbar-padding-right));
}

.window-controls-group__item {
  height: var(--window-toolbar-height);
  width: 46px;
}

.window-controls-group__item:hover {
  background-color: var(--highlight-color-4);
}

.window-controls-group__item:focus {
  outline: none;
  background-color: var(--highlight-color-4);
}
</style>
