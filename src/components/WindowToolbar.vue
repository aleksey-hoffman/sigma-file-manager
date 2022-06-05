<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-app-bar
    id="window-toolbar"
    :style="{'background': windowToolbarBackgroundColor}"
    app
    flat
    clipped-right
    clipped-left
    height="32px"
  >
    <div class="window-toolbar__drag-region" />
    <div class="window-toolbar__content-container">
      <div
        v-ripple
        class="window-toolbar__header-container"
        :style="!navigationPanelMiniVariant
          ? 'width: var(--nav-panel-width-expanded)'
          : 'width: var(--nav-panel-width)'"
        align-center
        @click="toggleNavigationPanel()"
      >
        <div class="nav-panel__item__icon-container pl-1">
          <v-icon class="nav-panel__item__icon window-toolbar__item">
            mdi-menu
          </v-icon>
        </div>
        <transition name="slide-fade-left">
          <div v-if="!navigationPanelMiniVariant">
            <div class="nav-panel__item__title">
              Sigma File Manager
            </div>
          </div>
        </transition>
      </div>

      <v-layout
        class="window-toolbar__content--main"
        :style="{
          'grid-template-columns': gridTemplateColumnsStyle
        }"
      >
        <!-- item-iterator -->
        <div
          v-for="(item, index) in windowToolbar.items"
          :key="'window-toolbar-item-' + index"
          :class="{
            'window-toolbar__content--main__flex': item.type === 'spacer'
          }"
        >
          <template v-if="item.type === 'workspaces-menu'">
            <workspaces-menu :icon-color="windowToolbarFontColor" />
          </template>

          <template v-if="item.type === 'tabs-menu'">
            <tabs-menu :icon-color="windowToolbarFontColor" />
          </template>

          <template v-if="showNavigatorTabBar(item) && item.breakpoint && $vuetify.breakpoint[item.breakpoint]">
            <navigator-tab-bar />
          </template>

          <template v-if="item.type === 'notification-menu' && item.ifCondition">
            <notification-menu :icon-color="windowToolbarFontColor" />
          </template>

          <template v-if="item.type === 'menu-button'">
            <v-tooltip
              bottom
              min-width="100px"
            >
              <template #activator="{ on }">
                <v-btn
                  class="window-toolbar__item"
                  icon
                  v-on="on"
                  @click="item.onClick()"
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
                />
                <div
                  v-show="[undefined, true].includes(item.tooltip.shortutIfCondition)"
                  class="tooltip__shortcut"
                  v-html="item.tooltip.shortcut"
                />
              </span>
            </v-tooltip>
          </template>

          <template v-if="item.type === 'window-controls-group'">
            <div class="window-controls-group">
              <div
                v-for="(item, index) in item.items"
                :key="'window-controls-group-item-' + index"
              >
                <v-tooltip
                  bottom
                  min-width="100px"
                >
                  <template #activator="{ on }">
                    <button
                      class="window-toolbar__item window-controls-group__item"
                      icon
                      v-on="on"
                      @click="item.onClick()"
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
                    />
                    <div
                      v-show="[undefined, true].includes(item.tooltip.shortutIfCondition)"
                      class="tooltip__shortcut"
                      v-html="item.tooltip.shortcut"
                    />
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
      window: electronRemote.getCurrentWindow(),
      animationTiming: {
        navigationPanel: 500,
      },
    }
  },
  computed: {
    ...mapGetters([
      'systemInfo',
      'windowToolbarFontColor',
    ]),
    ...mapFields({
      shortcuts: 'storageData.settings.shortcuts',
      dialogs: 'dialogs',
      homeBannerIsOffscreen: 'homeBannerIsOffscreen',
      navigationPanelMiniVariant: 'navigationPanel.miniVariant',
      homeBannerValue: 'storageData.settings.homeBanner.value',
      windowCloseButtonAction: 'storageData.settings.windowCloseButtonAction',
      homeBannerOverlaySelectedItem: 'storageData.settings.homeBanner.overlay.selectedItem',
      navigatorTabLayout: 'storageData.settings.navigator.tabs.layout',
      notifications: 'notifications',
    }),
    toolbarColor () {return this.$store.state.storageData.settings.theme.toolbarColor},
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
    hiddenNotifications () {
      return [
        ...this.notifications.filter(item => item.isHidden && item.isPinned),
        ...this.notifications.filter(item => item.isHidden && !item.isPinned),
      ]
    },
    gridTemplateColumnsStyle () {
      return this.windowToolbar.items.map(item => {
        if (item.ifCondition === false) {
          return '0'
        }

        if (item.breakpoint) {
          return this.$vuetify.breakpoint[item.breakpoint]
            ? item.width
            : '0'
        }
        else {
          return item.width
        }
      }).join(' ')
    },
    windowToolbar () {
      return {
        items: [
          {
            type: 'menu-button',
            width: '32px',
            icon: {
              size: '18px',
              name: 'mdi-message-question-outline',
            },
            tooltip: {
              description: 'App guide',
            },
            onClick: () => {this.dialogs.guideDialog.value = true},
          },
          {
            type: 'workspaces-menu',
            width: '48px',
          },
          {
            type: 'tabs-menu',
            width: '48px',
          },
          {
            type: 'navigator-tab-bar',
            width: 'minmax(300px, 50%)',
            breakpoint: 'mdAndUp',
          },
          {
            type: 'spacer',
            width: 'minmax(64px, 1fr)',
          },
          {
            type: 'notification-menu',
            ifCondition: this.hiddenNotifications.length > 0,
            width: '32px',
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
            width: '128px',
            items: [
              {
                type: 'window-controls',
                icon: {
                  size: '18px',
                  name: 'mdi-minus',
                },
                tooltip: {
                  description: 'Minimize window',
                  shortcut: this.shortcuts.toggleApp.shortcut,
                },
                onClick: () => this.minimizeWindow(),
              },
              {
                type: 'window-controls',
                icon: {
                  size: '16px',
                  name: 'mdi-aspect-ratio',
                },
                tooltip: {
                  description: 'Toggle window size',
                  shortcut: this.shortcuts.windowPosition.shortcut[this.systemInfo.platform],
                },
                onClick: () => this.maximizeWindow(),
              },
              {
                type: 'window-controls',
                icon: {
                  size: '18px',
                  name: 'mdi-close',
                },
                tooltip: {
                  description: `
                    Close window:
                    <br>Action: ${this.windowCloseButtonActionDescription}
                  `,
                  shortcut: `
                    Toggle window: ${this.shortcuts.toggleApp.shortcut}
                  `,
                  shortutIfCondition: this.windowCloseButtonAction !== 'closeApp',
                },
                onClick: () => this.closeWindow(),
              },
            ],
          },
        ],
      }
    },
  },
  methods: {
    showNavigatorTabBar (item) {
      return item.type === 'navigator-tab-bar' &&
      this.$route.name === 'navigator' &&
      this.navigatorTabLayout === 'compact-vertical-and-traditional-horizontal'
    },
    toggleAnimations () {
      if (this.$route.name === 'navigator') {
        let appLayoutElement = document.querySelector('#app')
        appLayoutElement.setAttribute('preserve-transition', true)
        setTimeout(() => {
          appLayoutElement.removeAttribute('preserve-transition')
        }, 500)
      }
    },
    toggleNavigationPanel () {
      this.toggleShadow()
      this.toggleAnimations()
      this.navigationPanelMiniVariant = !this.navigationPanelMiniVariant
    },
    toggleShadow () {
      this.removeShadow()
      setTimeout(() => {
        this.addShadow()
      }, this.animationTiming.navigationPanel)
    },
    removeShadow () {
      let cards = document.querySelectorAll('.item-card')
      cards.forEach(card => {
        card.setAttribute('optimized', true)
      })
    },
    addShadow () {
      let cards = document.querySelectorAll('.item-card')
      cards.forEach(card => {
        card.removeAttribute('optimized')
      })
    },
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
    },
  },
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
    display: grid;
    width: calc(100vw - 301px);
  }

.window-toolbar__drag-region {
  z-index: -1;
  top: 4px;
  left: 4px;
  display: block;
  position: absolute;
  width: calc(100% - 8px);
  height: calc(100% - 4px);
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
  flex-shrink: 0;
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
