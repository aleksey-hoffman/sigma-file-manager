<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-layout
    class="address-bar"
    align-center
  >
    <v-layout 
      class="address-bar__inner"
      align-center 
    >
      <!-- address-bar::menu:actions -->
      <v-menu offset-y>
        <template v-slot:activator="{on: menu, attrs}">
          <v-tooltip bottom :disabled="attrs['aria-expanded'] === 'true'">
            <template v-slot:activator="{on: tooltip}">
              <transition name="fade-in-1s">
                <v-btn
                  class="action-toolbar__button fade-in-1s"
                  v-on="{...tooltip, ...menu}"
                  icon
                >
                  <v-icon
                    class="action-toolbar__icon"
                    size="20px"
                  >mdi-wrap-disabled
                  </v-icon>
                </v-btn>
              </transition>
            </template>
            <span>Address bar actions</span>
          </v-tooltip>
        </template>
        <v-list class="pa-0" dense>
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

      <v-tooltip bottom>
        <template v-slot:activator="{on}">
          <v-btn
            class="action-toolbar__button fade-in-1s"
            v-on="on"
            @click="$store.dispatch('OPEN_ADDRESS_BAR_EDITOR')"
            icon
          >
            <v-icon
              class="action-toolbar__icon"
              size="16px"
            >mdi-cursor-text
            </v-icon>
          </v-btn>
        </template>
        <span>Edit address</span>
      </v-tooltip>

      <!-- address-bar::parts -->
      <v-layout
        id="address-bar__parts-container"
        class="address-bar__parts-container custom-scrollbar"
        @click="$store.dispatch('OPEN_ADDRESS_BAR_EDITOR')"
        align-center
      >
        <v-layout
          class="address-bar__parts-container__inner"
          align-center
        >
          <div v-for="(part, index) in addressParts" :key="`address-part-${index}`">
            <v-layout align-center>
              <div
                class="address-bar__part text-none"
                :class="{
                  'grey--text text--darken-1': part.isLast,
                  'cursor-pointer': !part.isLast
                }"
                @click.exact.stop="$store.dispatch('LOAD_DIR', {path: part.path})"
                @contextmenu="toggleDirContextMenu({event: $event, part})"
                text depressed small
                :disabled="part.isLast"
              >{{part.base}}
              </div>
              <div
                class="address-bar__part-divider" 
                v-if="!part.isLast"
              >/</div>
            </v-layout>
          </div>
        </v-layout>
      </v-layout>

      <!-- address-bar::input -->
      <transition name="slide-fade-down-300ms">
        <div
          v-show="addressBarEditor"
          style="position: absolute; top: 1px; left: 0px; width: 100%; z-index: 8"
          v-click-outside="{
            handler: handleAddressBarEditorClickOutside,
            include: addressBarEditorClickOutsideIncludedNodes
          }"
        >
          <v-card class="px-2 pt-2 pb-3" shadow="x3">
            <v-layout class="pl-2 py-0">
              <v-text-field
                class="mt-0 pt-0"
                v-model="query"
                @input="handleQueryInput()"
                @focus="$store.state.focusedField = 'address-bar'"
                @blur="$store.state.focusedField = ''"
                @keydown.enter="openQueryPath()"
                @keydown.tab.prevent.stop="cycleAutocompleteList($event)"
                autofocus single-line hide-details
                label="Enter valid path to a file / directory."
              ></v-text-field>

              <v-tooltip bottom>
                <template v-slot:activator="{on}">
                  <v-btn
                    class="ml-2"
                    v-on="on"
                    @click="closeAddressBarEditorOnClickOutside = !closeAddressBarEditorOnClickOutside"
                    icon
                  >
                    <div 
                      class="indicator--bottom"
                      :indicator-is-active="closeAddressBarEditorOnClickOutside"
                    >
                      <v-icon size="18px">mdi-pin-outline</v-icon>
                    </div>
                  </v-btn>
                </template>
                <span>
                  {{closeAddressBarEditorOnClickOutside ? 'Enabled' : 'Disabled'}} | 
                  Keep address bar editor opened when clicking outside
                </span>
              </v-tooltip>

              <v-btn
                class="ml-2"
                @click="addressBarEditor = false"
                icon
              ><v-icon>mdi-close</v-icon>
              </v-btn>
            </v-layout>
            <div class="px-2 mt-2 tooltip__shortcut">
              <span class="inline-code--light" style="padding: 1px 8px;">Tab</span> 
              or 
              <span class="inline-code--light" style="padding: 1px 8px;">Shift + Tab</span> 
              to autocomplete and iterate directory items; 
              <span class="inline-code--light" style="padding: 1px 8px;">Enter</span> 
              to open the path
            </div>
          </v-card>
        </div>
      </transition>
    </v-layout>
  </v-layout>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
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
      autocompleteListMatchedItems: [],
      closeAddressBarEditorOnClickOutside: true,
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
  mounted() {
    this.enableDualAxisScroll()
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
          title: 'Edit address',
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
    handleAddressBarEditorClickOutside () {
      if (!this.closeAddressBarEditorOnClickOutside) {
        this.addressBarEditor = false
      }
    },
    addressBarEditorClickOutsideIncludedNodes () {
      return [document.querySelector('.address-bar')]
    },
    enableDualAxisScroll () {
      const scrollContainer = document.querySelector('.address-bar__parts-container')
      scrollContainer.addEventListener('wheel', (event) => {
        scrollContainer.scrollLeft += event.deltaY
      })
    },
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
            if (options.openOnInputUpdate && pathIsFile) {return}
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
      this.openQueryPath({openOnInputUpdate: true})
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
            this.openQueryPath({openOnInputUpdate: true})
            // If path exists, automatically add slash at the end
            // if (!this.query.endsWith('/') && this.query.length > this.previousQuery.length) {this.query += '/'}
          }
          catch (error) {}
        }
      })
    },
    scrollAddressBarRight () {
      try {
        setTimeout(() => {
          let addressBarScrollContainerNode = document.querySelector('#address-bar__parts-container')
          if (addressBarScrollContainerNode) {
            addressBarScrollContainerNode.scrollTo({
              left: 1000,
              behavior: 'smooth'
            })
          }
        }, 50)
      }
      catch (error) {}
    },
    async toggleDirContextMenu (params) {
      let dirItem = await this.$store.dispatch('GET_DIR_ITEM_INFO', params.part.path)
      await this.$store.dispatch('REPLACE_SELECTED_DIR_ITEMS', [dirItem])
      await this.$store.dispatch('SET_CONTEXT_MENU', {
        value: 'toggle',
        x: params.event.clientX,
        y: params.event.clientY
      })
    }
  }
}
</script>

<style scoped>
.address-bar {
  height: 100%;
  max-height: 48px;
  width: 100%;
}

.address-bar__inner {
  height: 34px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: 0.1s ease;
}

.address-bar__inner:hover {
  background-color: var(--bg-color-1);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: 0.1s ease;
}

.address-bar__parts-container {
  white-space: nowrap;
  height: 48px;
  margin-bottom: 3px;
  margin-right: 6px;
  padding-top: 3px
}

.address-bar__parts-container:hover {
  cursor: pointer;
}

.address-bar__parts-container__inner {
  height: 34px;
  width: 100%;
  min-width: fit-content;
  margin-bottom: 1px;
  padding: 0 4px;
}

.address-bar__part {
  padding: 0 6px;
  padding-top: 2px;
  color: var(--color-6) !important;
}

.address-bar__part-divider {
  padding-top: 2px;
}

.address-bar__parts-container:not(.highlight) 
  .address-bar__part:hover {
    color: var(--color-1);
    background-color: var(--highlight-color-4);
    cursor: pointer;
    transition: 0.1s ease;
    display: flex;
    align-items: center;
  }

.address-bar__parts-container.highlight:hover
  * {
    cursor: pointer;
    opacity: 0.8;
  }
</style>
