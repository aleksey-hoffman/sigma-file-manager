<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-tooltip
    :disabled="!showTabPreview"
    bottom
    max-width="200px"
  >
    <template #activator="{ on }">
      <div
        v-ripple
        class="navigator-tab"
        :style="{
          '--tab-width': `${navigatorTabWidth}px`
        }"
        :is-active="tab.path === $store.state.navigatorView.currentDir.path"
        v-on="on"
        @click.stop="tabOnClick(tab)"
      >
        <div class="navigator-tab__title">
          <span
            v-if="showTabStorageIndicator"
            class="navigator-tab__indicator-container"
          >
            {{tabIndicatorText(tab)}}
          </span>
          <span>
            {{tab.name}}
          </span>
        </div>

        <button
          class="navigator-tab__close-button"
          x-small
          icon
          @click.stop="tabCloseButtonOnClick(tab)"
        >
          <v-icon size="14px">
            mdi-close
          </v-icon>
        </button>
      </div>
    </template>
    <span>
      <div class="navigator-tab__tooltip-title">
        {{tab.name}}
      </div>
      <div class="navigator-tab__tooltip-subtitle">
        {{tab.path}}
      </div>
    </span>
  </v-tooltip>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'

export default {
  props: {
    tab: {
      type: Object,
      tabOnClick: Function,
      default: () => ({}),
    },
  },
  computed: {
    ...mapGetters([
      'selectedWorkspace',
    ]),
    ...mapFields({
      showTabPreview: 'storageData.settings.navigator.tabs.showTabPreview',
      showTabStorageIndicator: 'storageData.settings.navigator.tabs.showTabStorageIndicator',
      navigatorTabWidth: 'storageData.settings.navigator.tabs.tabWidth',
    }),
  },
  methods: {
    tabIndicatorText (tab) {
      if (process.platform === 'win32') {
        return this.$utils.getPathRoot(tab.path).replace('/', '')
      }
      else {
        return '/'
      }
    },
    tabOnClick (tab) {
      let tabIndex = this.selectedWorkspace.tabs.findIndex(item => item.path === tab.path)
      this.$store.dispatch('SWITCH_TAB', tabIndex + 1)
    },
    tabCloseButtonOnClick (tab) {
      this.$store.dispatch('CLOSE_TAB', tab)
    },
  },
}
</script>

<style>
.navigator-tab {
  position: relative;
  display: flex;
  align-items: center;
  height: var(--tab-height);
  min-width: 0;
  width: var(--tab-width, 100px);
  padding: 0px 8px;
  padding-right: 4px;
  color: var(--navigator-tab-color);
  border: 1px solid rgb(255, 255, 255, 0.06);
  border-top: none;
  background-color: transparent;
  cursor: pointer;
  user-select: none;
  -webkit-app-region: no-drag;
  transition: all 0.3s ease;
}

.navigator-tab[is-active] {
  color: var(--navigator-tab-color-active);
  background-color: var(--navigator-tab-bg-color-active);
}

.navigator-tab[is-active]::after {
  content: "";
  width: 100%;
  position: absolute;
  bottom: 0;
  left: 0;
  height: 1px;
  background-color: #0e829688;
  box-shadow: 0 0px 6px #0e6f9688;
}

.navigator-tab:hover {
  background-color: var(--navigator-tab-bg-color-hover);
  transition: all 0.1s ease;
}

.navigator-tab__title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
}

.navigator-tab__indicator-container {
  padding: 2px 4px;
  padding-right: 0;
  margin-right: 4px;
  border-radius: 4px;
  background-color: rgb(var(--key-color-1-value), 0.3);
}

.navigator-tab__close-button {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  right: 0;
  width: 24px;
  height: 24px;
  border-radius: 0;
  transition: background-color 0.5s ease;
}

.navigator-tab:hover
  .navigator-tab__close-button {
    background-color: var(--highlight-color-4);
    transition: background-color 0.5s ease;
  }

.navigator-tab__tooltip-title {
  color: var(--color-5);
  font-size: 16px;
  word-break: break-word;
}

.navigator-tab__tooltip-subtitle {
  color: var(--color-7);
  font-size: 14px;
  word-break: break-word;
}
</style>