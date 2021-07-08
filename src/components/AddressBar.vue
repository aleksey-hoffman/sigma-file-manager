<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-layout
    style="height: 42px"
    align-center
  >
    <!-- address-bar::menu:actions -->
    <v-menu offset-y>
      <template v-slot:activator="{ on: menu, attrs }">
        <v-tooltip bottom :disabled="attrs['aria-expanded'] === 'true'">
          <template v-slot:activator="{ on: tooltip }">
            <transition name="fade-in-1s">
              <v-btn
                v-on="{ ...tooltip, ...menu }"
                class="action-toolbar__button fade-in-1s"
                icon
              >
                <v-icon
                  size="20px"
                  class="action-toolbar__icon"
                >mdi-wrap-disabled
                </v-icon>
              </v-btn>
            </transition>
          </template>
          <span>Address bar actions</span>
        </v-tooltip>
      </template>
      <v-list dense class="pa-0">
        <v-list-item
          v-for="(item, index) in addressBarMenuItems"
          :key="index"
          @click="addressBarMenuHandler(item.action)"
        >
          <v-list-item-action class="pr-0">
            <v-icon size="16px">{{item.icon}}</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title class="subheading">{{item.title}}</v-list-item-title>
            <v-list-item-subtitle class="subheading">{{item.shortcut}}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- address-bar::parts -->
    <v-layout
      id="address-bar__parts-container"
      class="address-bar__parts-container custom-scrollbar mr-4"
      style="height: 100%"
      align-center
    >
      <div v-for="(part, index) in addressParts" :key="`address-part-${index}`">
        <v-layout align-center>
          <div
            @click="$store.dispatch('LOAD_DIR', { path: part.path })"
            text depressed small
            class="address-bar__part text-none mx-2"
            :class="{
              'grey--text text--darken-1': part.isLast,
              'cursor-pointer': !part.isLast
            }"
          >{{part.base}}
          </div>
          <div v-if="!part.isLast">/</div>
        </v-layout>
      </div>
    </v-layout>

    <!-- address-bar::input -->
    <transition name="slide-fade-down-300ms">
      <div
        v-show="addressBarEditor"
        style="position: absolute; top: 1px; left: 0px; width: 100%; z-index: 8"
      >
        <v-card class="px-2 pt-2 pb-3" shadow="x3">
          <v-layout class="pl-2 py-0">
            <v-text-field
              @input="handleQueryInput()"
              v-model="query"
              @focus="$store.state.focusedField = 'address-bar'"
              @blur="$store.state.focusedField = ''"
              @keydown.enter="openQueryPath()"
              @keydown.tab.prevent.stop="cycleAutocompleteList($event)"
              autofocus single-line hide-details
              label="Enter valid path to a file / directory."
              class="mt-0 pt-0"
            ></v-text-field>
            <v-btn
              @click="addressBarEditor = false"
              icon
              class="ml-2"
            ><v-icon>mdi-close</v-icon>
            </v-btn>
          </v-layout>
          <div class="px-2 mt-2 tooltip__shortcut">
            Shortcuts: [Tab] or [Shift + Tab] to autocomplete
            and iterate directory items; [Enter] to open the path
          </div>
        </v-card>
      </div>
    </transition>
  </v-layout>
</template>

<script>
import { mapFields } from 'vuex-map-fields'
const fs = require('fs')
const PATH = require('path')

export default {
  data () {
    return {
      isTruncated: false,
      previousQuery: '',
      query: '',
      selectedSuggestionIndex: -1,
      autocompleteList: [],
      autocompleteListMatchedItems: []
    }
  },
  watch: {
    query (value, prevValue) {
      this.previousQuery = prevValue
    },
    addressBarEditor (value) {
      if (value) {
        this.query = this.currentDir.path.replace(/\\/g, '/')
      }
    },
    addressParts () {
      this.scrollAddressBarRight()
    }
  },
  computed: {
    ...mapFields({
      currentDir: 'navigatorView.currentDir',
      addressBarEditor: 'addressBarEditor',
      shortcuts: 'storageData.settings.shortcuts'
    }),
    addressBarMenuItems () {
      return [
        {
          title: 'Type in address manually',
          action: 'OPEN_ADDRESS_BAR_EDITOR',
          shortcut: this.shortcuts.focusAddressBar.shortcut,
          icon: 'mdi-cursor-text'
        },
        {
          title: 'Copy path to clipboard',
          action: 'COPY_CURRENT_DIR_PATH',
          shortcut: this.shortcuts.copyCurrentDirPath.shortcut,
          icon: 'far fa-copy'
        },
        {
          title: 'Open copied path',
          action: 'OPEN_DIR_PATH_FROM_OS_CLIPBOARD',
          shortcut: this.shortcuts.openCopiedPath.shortcut,
          icon: 'far fa-clipboard'
        }
      ]
    },
    addressParts () {
      try {
        const formattedList = []
        // Split current path
        const list = this.currentDir.path
          .replace(/\\/g, '/')
          .split('/')
          .filter(path => path !== '')
        // Create a list from formatted parts {path: '', base: ''}
        list.forEach((part, index) => {
          const obj = {}
          const path = list.slice(0, index + 1).join('/')
          obj.path = path
          obj.base = part
          obj.isLast = (list.length - 1) === index
          formattedList.push(obj)
        })
        // Add slash to the first part if needed
        formattedList[0].path = formattedList[0].path.includes('/')
          ? formattedList[0].path
          : formattedList[0].path + '/'

        return formattedList
      }
      catch (error) {
        return []
      }
    }
  },
  methods: {
    openQueryPath (options = {}) {
      fs.access(this.query, fs.constants.F_OK, (error) => {
        if (error) {
          this.$eventHub.$emit('notification', {
            action: 'update-by-type',
            type: 'address-bar:open-path',
            closeButton: true,
            timeout: 3000,
            title: 'Path cannot be opened',
            message: error
          })
        }
        else {
          try {
            const pathIsFile = fs.statSync(this.query).isFile()
            // Don't open files when path is opened automatically
            if (options.openOnInputUpdate && pathIsFile) { return }
            this.$store.dispatch('OPEN_DIR_ITEM_FROM_PATH', this.query)
          }
          catch (error) {}
        }
      })
    },
    handleQueryInput () {
      this.query = this.query.replace(/\\/g, '/')
      this.updateAutocompleteList()
      this.checkIsTruncated()
    },
    checkIsTruncated () {
      // Checks if address bar is overflown and became scrollable
      // Can be used to dynamically add scroll buttons
      const element = document.querySelector('#address-bar__parts-container')
      const isTruncated = element.scrollWidth > element.clientWidth
      this.isTruncated = isTruncated
    },
    cycleAutocompleteList (event) {
      const lastIndex = this.autocompleteListMatchedItems.length - 1
      if (event.shiftKey) {
        if (this.selectedSuggestionIndex <= 0) {
          this.selectedSuggestionIndex = lastIndex
        }
        else {
          this.selectedSuggestionIndex -= 1
        }
      }
      else {
        if (this.selectedSuggestionIndex >= lastIndex) {
          this.selectedSuggestionIndex = 0
        }
        else {
          this.selectedSuggestionIndex += 1
        }
      }
      const matchedPath = this.autocompleteListMatchedItems[this.selectedSuggestionIndex]
      if (matchedPath) {
        this.query = this.autocompleteListMatchedItems[this.selectedSuggestionIndex]
      }
      this.openQueryPath({ openOnInputUpdate: true })
    },
    addressBarMenuHandler (action) {
      this.$store.dispatch(action)
    },
    updateAutocompleteList () {
      let paths = []
      fs.access(this.query, fs.constants.F_OK, (error) => {
        // If query path doesn't exist
        if (error) {
          try {
            const dir = PATH.parse(this.query).dir
            paths = fs.readdirSync(dir)
            paths.forEach((path, index) => {
              paths[index] = PATH.join(dir, path).replace(/\\/g, '/')
            })
            this.autocompleteList = paths
            this.autocompleteListMatchedItems = paths.filter(item => {
              return item.toLowerCase().startsWith(this.query.toLowerCase())
            })
            this.selectedSuggestionIndex = -1
          }
          catch (error) {}
        }
        // If query path does exist
        else {
          try {
            paths = fs.readdirSync(this.query)
            paths.forEach((path, index) => {
              paths[index] = PATH.join(this.query, path).replace(/\\/g, '/')
            })
            this.autocompleteList = paths
            this.autocompleteListMatchedItems = paths
            this.selectedSuggestionIndex = -1
            this.openQueryPath({ openOnInputUpdate: true })
            // If path exists, automatically add slash at the end
            // if (!this.query.endsWith('/') && this.query.length > this.previousQuery.length) { this.query += '/' }
          }
          catch (error) {}
        }
      })
    },
    scrollAddressBarRight () {
      try {
        setTimeout(() => {
          document.querySelector('#address-bar__parts-container').scrollTo({
            left: 1000,
            behavior: 'smooth'
          })
        }, 50)
      }
      catch (error) {}
    }
  }
}
</script>

<style scoped>
.address-bar__parts-container {
  white-space: nowrap;
}

.address-bar__part {
  color: var(--color-6) !important;
}
</style>
