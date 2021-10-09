<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <transition name="slide-fade-up">
    <v-footer
      id="clipboard-toolbar"
      class="clipboard-toolbar"
      v-show="showClipboardToolbar"
      fixed inset app height="36px"
    >
      <!-- clipboard: {type: selected} -->
      <div
        class="clipboard-toolbar__container fade-in-1s"
        v-show="showSelectedItemsClipboardToolbar"
      >
        <div class="clipboard-toolbar__description">
          {{itemClipboardDescription}}
        </div>

        <v-btn
          class="clipboard-toolbar__button"
          @click="$store.dispatch('SELECT_ALL_DIR_ITEMS')"
          text small
        >select all
        </v-btn>

        <v-btn
          class="clipboard-toolbar__button"
          @click="$store.dispatch('DESELECT_ALL_DIR_ITEMS')"
          text small
        >deselect all
        </v-btn>

        <v-btn
          class="clipboard-toolbar__button"
          @click="toggleCurrentDirContextMenu"
          text small
        >menu
        </v-btn>
      </div>

      <!-- clipboard: {type: copied} -->
      <div
        class="clipboard-toolbar__container fade-in-1s"
        v-show="fsClipboard.type === 'copy'"
      >
        <div class="clipboard-toolbar__description">
          {{itemClipboardDescription}}
        </div>

        <v-menu top offset-y>
          <template v-slot:activator="{ on }">
            <v-btn
              class="clipboard-toolbar__button"
              v-on="on"
              :text="$vuetify.breakpoint.mdAndUp"
              :icon="$vuetify.breakpoint.smAndDown"
              small
            >
              <v-icon size="14">mdi-format-list-bulleted</v-icon>
              <div v-show="$vuetify.breakpoint.mdAndUp" class="ml-2">
                show items
              </div>
            </v-btn>
          </template>
          <v-list dense max-width="300" max-height="280">
            <v-list-item
              v-for="(item, index) in fsClipboard.items"
              :key="index"
            >
              <v-list-item-content>
                <v-list-item-title>{{item.name}}</v-list-item-title>
                <v-list-item-subtitle>{{item.path}}</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-btn
          class="clipboard-toolbar__button"
          v-if="fsClipboard.items.length !== 0"
          @click="$store.dispatch('PASTE_FS_CLIPBOARD_DIR_ITEMS')"
          :text="$vuetify.breakpoint.mdAndUp"
          :icon="$vuetify.breakpoint.smAndDown"
          small
        >
          <v-icon size="14">mdi-content-paste</v-icon>
          <div v-show="$vuetify.breakpoint.mdAndUp" class="ml-2">
            Copy all here
          </div>
        </v-btn>

        <v-btn
          class="clipboard-toolbar__button"
          @click="discardFsClipboardItems()"
          :text="$vuetify.breakpoint.mdAndUp"
          :icon="$vuetify.breakpoint.smAndDown"
          small
        >
          <v-icon size="18">mdi-close</v-icon>
          <div v-show="$vuetify.breakpoint.mdAndUp" class="ml-2">
            discard
          </div>
        </v-btn>
      </div>

      <!-- clipboard: {type: move} -->
      <div
        class="clipboard-toolbar__container fade-in-1s"
        v-show="fsClipboard.type === 'move'"
      >
        <div class="clipboard-toolbar__description">
          {{itemClipboardDescription}}
        </div>

        <v-menu top offset-y>
          <template v-slot:activator="{ on }">
            <v-btn
              class="clipboard-toolbar__button"
              v-on="on"
              :text="$vuetify.breakpoint.mdAndUp"
              :icon="$vuetify.breakpoint.smAndDown"
              small
            >
              <v-icon size="14">mdi-format-list-bulleted</v-icon>
              <div v-show="$vuetify.breakpoint.mdAndUp" class="ml-2">
                show items
              </div>
            </v-btn>
          </template>
          <v-list dense max-width="300" max-height="280">
            <v-list-item
              v-for="(item, index) in fsClipboard.items"
              :key="index"
            >
              <v-list-item-content>
                <v-list-item-title>{{item.name}}</v-list-item-title>
                <v-list-item-subtitle>{{item.path}}</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-tooltip top :disabled="!movePreparedDirItemsIsDisabled">
          <template v-slot:activator="{ on }">
            <div v-on="on">
              <v-btn
                class="clipboard-toolbar__button"
                v-if="fsClipboard.items.length !== 0"
                :disabled="movePreparedDirItemsIsDisabled"
                @click="$store.dispatch('PASTE_FS_CLIPBOARD_DIR_ITEMS')"
                :text="$vuetify.breakpoint.mdAndUp"
                :icon="$vuetify.breakpoint.smAndDown"
                small
              >
                <v-icon size="14" class="css-override">mdi-content-paste</v-icon>
                <div v-show="$vuetify.breakpoint.mdAndUp" class="ml-2">
                  Move all here
                </div>
              </v-btn>
            </div>
          </template>
          <span>Dir items are already located in this directory</span>
        </v-tooltip>

        <v-btn
          class="clipboard-toolbar__button"
          @click="discardFsClipboardItems()"
          :text="$vuetify.breakpoint.mdAndUp"
          :icon="$vuetify.breakpoint.smAndDown"
          small
        >
          <v-icon size="18">mdi-close</v-icon>
          <div v-show="$vuetify.breakpoint.mdAndUp" class="ml-2">
            cancel
          </div>
        </v-btn>
      </div>
    </v-footer>
  </transition>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'
const PATH = require('path')

export default {
  computed: {
    ...mapFields({
      currentDir: 'navigatorView.currentDir',
      contextMenus: 'contextMenus',
      fsClipboard: 'navigatorView.clipboard.fs'
    }),
    ...mapGetters([
      'selectedDirItems'
    ]),
    showClipboardToolbar () {
      const someClipboardIsActive = this.showSelectedItemsClipboardToolbar ||
        this.showFsClipboardToolbar
      const showClipboard = this.$route.name === 'navigator' && someClipboardIsActive
      this.$store.state.clipboardToolbar = showClipboard
      return showClipboard
    },
    showSelectedItemsClipboardToolbar () {
      return this.selectedDirItems.length > 1 &&
        this.fsClipboard.items.length === 0
    },
    showFsClipboardToolbar () {
      return this.fsClipboard.items.length > 0
    },
    itemClipboardDescription () {
      let type = ''
      let itemLength = this.fsClipboard.items.length
      if (this.showSelectedItemsClipboardToolbar) {
        type = 'Selected'
        itemLength = this.selectedDirItems.length
      }
      else if (this.fsClipboard.type === 'copy') {
        type = 'Prepared for copying'
      }
      else if (this.fsClipboard.type === 'move') {
        type = 'Prepared for moving'
      }
      const itemWord = this.$localizeUtils.pluralize(itemLength, 'item')
      return `${type}: ${itemLength} ${itemWord}`
    },
    movePreparedDirItemsIsDisabled () {
      return this.fsClipboard.items.some(item => {
        return this.currentDir.path === PATH.parse(item.path).dir
      })
    }
  },
  methods: {
    toggleCurrentDirContextMenu (event) {
      this.contextMenus.dirItem.x = event.clientX + 12
      this.contextMenus.dirItem.y = event.clientY
      this.contextMenus.dirItem.value = !this.contextMenus.dirItem.value
    },
    discardFsClipboardItems () {
      this.$store.dispatch('CLEAR_FS_CLIPBOARD')
    }
  }
}
</script>

<style>
#clipboard-toolbar {
  width: 100%;
  padding: 0px 32px;
  margin-top: 0 !important;
  background-color: rgba(var(--bg-color-1-value), 0.5);
  backdrop-filter: blur(8px);
  z-index: 3;
  box-shadow: 8px -2px 32px rgb(0, 0, 0, 0.3);
}

.clipboard-toolbar__container {
  display: flex;
  align-items: center;
  color: var(--icon-color-2) !important;
}

.clipboard-toolbar__icon {
  color: var(--icon-color-2) !important;
}

.clipboard-toolbar__button {
  margin: 0px 4px !important;
  color: var(--icon-color-2) !important;
}

.clipboard-toolbar__description {
  font-size: 14px;
  margin-right: 16px;
}
</style>
