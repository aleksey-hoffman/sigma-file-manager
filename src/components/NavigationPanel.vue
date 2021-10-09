<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-navigation-drawer
    v-model="navigationPanelModel"
    :mini-variant="navigationPanelMiniVariant"
    touchless app permanent floating mini-variant-width="64" width="280"
    id="nav-panel"
    class="nav-panel"
  >
    <v-layout column fill-height class="unselectable">
      <v-layout column class="nav-panel__main-content custom-scrollbar">
        <!-- list::global-search -->
        <div>
          <v-tooltip
            right
            :disabled="!navigationPanelMiniVariant"
          >
            <template v-slot:activator="{ on }">
              <v-layout
                v-on="on"
                @click="$store.dispatch('TOGGLE_GLOBAL_SEARCH')"
                align-center v-ripple
                class="nav-panel__item --search"
                :class="{'active-route': globalSearchWidget }"
              >
                <div class="nav-panel__item__indicator"></div>
                <div class="nav-panel__item__icon-container">
                  <v-icon class="nav-panel__item__icon">
                    mdi-magnify
                  </v-icon>
                </div>
                <transition name="slide-fade-left">
                  <div v-if="!navigationPanelMiniVariant">
                    <div class="nav-panel__item__title">
                      {{$localize.get('text_global_search_title')}}
                    </div>
                  </div>
                </transition>
              </v-layout>
            </template>
            <span>
              <div class="tooltip__description">
                {{$localize.get('text_global_search_title')}}
              </div>
              <div class="tooltip__shortcut">
                {{shortcuts.toggleGlobalSearch.shortcut}}
              </div>
            </span>
          </v-tooltip>
        </div>

        <div
          class="nav-panel__divider"
          :class="{
            'opacity-1': navigationPanelMiniVariant === false,
            'opacity-0': navigationPanelMiniVariant === true
          }">
        </div>

        <!-- list::navigation-views -->
        <div>
          <v-tooltip
            v-for="(item, index) in navigationPanelItems"
            :key="index"
            right
            :disabled="!navigationPanelMiniVariant"
          >
            <template v-slot:activator="{ on }">
              <v-layout
                v-on="on"
                @click="$store.dispatch('SWITCH_ROUTE', item)"
                class="nav-panel__item"
                :class="{'active-route': $route.path === item.to}"
                align-center v-ripple
              >
                <div class="nav-panel__item__indicator"></div>
                <div class="nav-panel__item__icon-container">
                <v-icon class="nav-panel__item__icon">
                  {{item.icon}}
                </v-icon>
                </div>
                <transition name="slide-fade-left">
                  <div v-if="!navigationPanelMiniVariant">
                    <div class="nav-panel__item__title">
                      {{$localize.get(item.title)}}
                    </div>
                  </div>
                </transition>
              </v-layout>
            </template>
            <span>
              <div class="tooltip__description">
                {{$localize.get(item.title)}}
              </div>
              <div class="tooltip__shortcut">
                {{shortcuts.switchView.shortcut.replace('[1 - 9]', index + 1)}}
              </div>
            </span>
          </v-tooltip>
        </div>

        <v-spacer></v-spacer>

        <div
          class="nav-panel__divider"
          :class="{
            'opacity-1': navigationPanelMiniVariant === false,
            'opacity-0': navigationPanelMiniVariant === true
          }">
        </div>

        <!-- list::storage-devices -->
        <div class="mb-2">
          <v-tooltip
            v-for="(drive, index) in drives"
            :key="`${index}-${drive.mount}`"
            right
          >
            <template v-slot:activator="{ on }">
              <v-layout
                v-on="on"
                @click="$store.dispatch('OPEN_DIR_ITEM_FROM_PATH', drive.path)"
                class="nav-panel__item"
                align-center v-ripple
              >
                <div class="nav-panel__item__indicator"></div>
                <div class="nav-panel__item__icon-container">
                  <v-icon 
                    class="nav-panel__item__icon"
                    :size="$utils.getDriveIcon(drive).size" 
                  >
                    {{$utils.getDriveIcon(drive).icon}}
                  </v-icon>
                </div>
                <transition name="slide-fade-left">
                  <div v-if="!navigationPanelMiniVariant">
                    <div 
                      class="nav-panel__item__title"
                      v-if="drive.type === 'cloud'"
                    >
                      {{drive.titleSummary}}
                    </div>
                    <div 
                      class="nav-panel__item__title mb-1"
                      v-else
                    >
                      <v-layout align-center>
                        <div class="nav-panel__item__title__mount">
                          <span
                            v-if="systemInfo.platform === 'win32'"
                            class="text-uppercase caption"
                          >{{$localize.get('text_drive')}}
                          </span>
                          {{drive.mount}}
                        </div>
                        <v-spacer></v-spacer>
                        <div class="caption">
                          {{drive.size.free && $utils.prettyBytes(drive.size.free, 1)}} left
                        </div>
                      </v-layout>
                      <div v-if="drive.percentUsed">
                        <v-progress-linear
                          :value="`${drive.percentUsed}`"
                          height="4"
                          :background-color="$utils.getCSSVar('--bg-color-2')"
                          :color="$utils.getCSSVar('--color-1-alt-1')"
                        ></v-progress-linear>
                      </div>
                    </div>
                  </div>
                </transition>
              </v-layout>
            </template>
            <span>
              <div>{{drive.titleSummary}}</div>
              <div>{{drive.infoSummary}}</div>
            </span>
          </v-tooltip>
        </div>
      </v-layout>
    </v-layout>
 </v-navigation-drawer>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import {mapGetters} from 'vuex'

export default {
  computed: {
    ...mapGetters([
      'homeBannerSelectedMedia',
      'systemInfo'
    ]),
    ...mapFields({
      shortcuts: 'storageData.settings.shortcuts',
      drives: 'drives',
      globalSearchWidget: 'globalSearch.widget',
      navigationPanelModel: 'navigationPanel.model',
      navigationPanelMiniVariant: 'navigationPanel.miniVariant',
      navigationPanelItems: 'navigationPanel.items',
      homeBannerValue: 'storageData.settings.homeBanner.value',
      currentDir: 'navigatorView.currentDir'
    })
  },
}
</script>

<style>
.nav-panel img,
.nav-panel video {
  position: fixed;
  /* top: 0; */
  width: 100vw;
  height: 100vh;
  z-index: -1;
  /* filter: blur(24px); */
  opacity: 1;
  /* left: 50%;
  transform: translate(-50%, 8px); */
}

.nav-panel {
  background-color: var(--bg-color-1) !important;
  padding-top: var(--window-toolbar-height);
}

.nav-panel__main-content {
  box-shadow: inset -48px 0 16px -48px rgb(0,0,0,0.1);
  border-right: 1px solid var(--divider-color-1);
}

.nav-panel__item {
  display: grid !important;
  grid-template-columns: var(--nav-panel-active-indicator-width) var(--nav-panel-icon-width) 1fr;
  grid-auto-rows: 48px;
  align-content: center;
  cursor: pointer;
  transition: background-color 0.3s ease;
  user-select: none;
}

.nav-panel__item.--search {
  grid-auto-rows: 42px !important;
}

.nav-panel__item:hover {
  background: var(--nav-panel-color_hover);
}

.nav-panel__item__icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-panel__item__icon {
  color: var(--icon-color-2) !important;
}

.nav-panel__item__title {
  padding-left: var(--nav-panel-active-indicator-width);
  padding-right: 16px;
  overflow: hidden;
  white-space: nowrap;
  color: var(--nav-panel-color-1);
}

.nav-panel__item__title__mount {
  width: 120px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Active state */
.nav-panel__item.active-route {
  background-color: var(--nav-panel-item-bg-color_active) !important;
  color: var(--nav-panel-item-bg-color_active) !important;
}

.nav-panel__item.active-route .nav-panel__item__icon {
  color: var(--icon-color-3) !important;
}

.nav-panel__item.active-route .nav-panel__item__title {
  color: var(--icon-color-1) !important;
}

.nav-panel__item.active-route .nav-panel__item__indicator {
  width: var(--nav-panel-active-indicator-width);
  height: 100%;
  background-color: var(--nav-panel-indicator-color);
}

.nav-panel__divider {
  border-bottom: 1px solid var(--divider-color-1);
}
</style>
