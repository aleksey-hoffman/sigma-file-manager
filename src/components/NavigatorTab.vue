<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    class="navigator-tab"
    @click.stop="tabOnClick(tab)"
    :is-active="tab.path === $store.state.navigatorView.currentDir.path"
    v-ripple
  >
    <div class="navigator-tab__title">
      <span class="navigator-tab__indicator-container">
        {{tabIndicatorText(tab)}}
      </span>
      <span>
        {{tab.name}}
      </span>
    </div>

    <v-btn
      class="navigator-tab__close-button"
      @click.stop="tabCloseButtonOnClick(tab)"
      x-small
      icon
    >
      <v-icon size="14px">mdi-close</v-icon>
    </v-btn>
  </div>
</template>

<script>
import {mapGetters} from 'vuex'

export default {
  props: {
    tab: {
      type: Object,
      tabOnClick: Function,
    },
  },
  computed: {
    ...mapGetters([
      'selectedWorkspace',
    ]),
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
  height: calc(var(--window-toolbar-height) - 4px);
  min-width: 0;
  width: 100px;
  padding: 0px 8px;
  padding-right: 4px;
  color: var(--navigator-tab-color);
  border-right: 1px solid rgb(255, 255, 255, 0.08);
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
  right: 4px;
  background-color: rgb(44, 47, 53);
}
</style>