<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <transition name="slide-fade-down-300ms">
    <div
      v-show="widget"
      class="widget"
    >
      <div
        class="widget__container"
        shadow="x3"
      >
        <!-- widget::overlays -->
        <div
          v-show="scanInProgress"
          class="widget__overlay--scan-in-progress"
        >
          <v-layout
            column
            align-center
            justify-center
            class="title"
          >
            Drive scan is in progress
          </v-layout>
        </div>
        <div
          v-show="searchScanWasInterrupted && !scanInProgress"
          class="widget__overlay--scan-in-progress"
        >
          <v-layout
            column
            align-center
            justify-center
          >
            <div class="title">
              Drive scan was interrupted.
            </div>
            <div>
              Search data is incomplete
            </div>
            <v-btn
              small
              class="button-1 mt-2"
              @click="$eventHub.$emit('app:method', {
                method: 'initGlobalSearchDataScan'
              })"
            >
              re-scan drives
            </v-btn>
          </v-layout>
        </div>

        <!-- widget::toolbar -->
        <div class="widget__input-container">
          <v-btn
            small
            icon
            data-action="search-icon"
            class="widget__input__button"
          >
            <v-icon class="action-toolbar__icon">
              mdi-magnify
            </v-icon>
          </v-btn>
          <input
            ref="globalSearchInput"
            v-model="query"
            placeholder="Search"
            :disabled="scanInProgress"
            hide-details
            single-line
            flat
            box
            class="widget__input"
            @focus="$store.dispatch('SET', {
              key: 'focusedField',
              value: 'search'
            })"
            @blur="$store.dispatch('SET', {
              key: 'focusedField',
              value: ''
            })"
            @keyup="handleInputKeyUp()"
          />

          <div class="widget__input__buttons-container">
            <!-- button:clear-search-input -->
            <div
              class="widget__input__button"
              data-action="clear"
              :data-visible="query.length > 0"
            >
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-btn
                    icon
                    v-on="on"
                    @click="query = ''"
                  >
                    <v-icon
                      size="18px"
                      class="action-toolbar__icon"
                    >
                      mdi-backspace-outline
                    </v-icon>
                  </v-btn>
                </template>
                <span>Clear search field</span>
              </v-tooltip>
            </div>

            <!-- button:toggle-options -->
            <div
              class="widget__input__button"
              data-action="options"
            >
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-btn
                    icon
                    v-on="on"
                    @click="showWidgetOptions = !showWidgetOptions"
                  >
                    <v-icon
                      size="20px"
                      class=""
                    >
                      mdi-tune
                    </v-icon>
                  </v-btn>
                </template>
                <span>
                  {{showWidgetOptions
                    ? 'Hide options'
                    : 'Show options'}}
                </span>
              </v-tooltip>
            </div>

            <!-- button:close-widget -->
            <div
              class="widget__input__button"
              data-action="close"
            >
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-btn
                    icon
                    v-on="on"
                    @click="widget = false"
                  >
                    <v-icon>mdi-close</v-icon>
                  </v-btn>
                </template>
                <span>Close global search</span>
              </v-tooltip>
            </div>
          </div>
        </div>

        <div class="widget__main-container">
          <!-- widget::info-container -->
          <div class="widget__info-container">
            <div class="widget__info-container__header">
              <div v-show="query.length === 0">
                <v-layout
                  align-center
                  justify-space-between
                  class="text--sub-title-1"
                >
                  Search data
                  <!-- button:re-scan -->
                  <v-btn
                    class="button-1"
                    small
                    @click="$eventHub.$emit('app:method', {
                      method: 'initGlobalSearchDataScan'
                    })"
                  >
                    re-scan drives
                  </v-btn>
                </v-layout>
                <v-layout>
                  <div>
                    <v-icon
                      class="action-toolbar__icon mr-2"
                      size="18px"
                    >
                      mdi-subdirectory-arrow-right
                    </v-icon>
                    Scan depth: {{globalSearchScanDepth}} directories
                  </div>
                </v-layout>
                <updating-component :component="'lastScanTimeElapsed'" />
              </div>

              <!-- widget::search-results -->
              <div v-show="query.length > 0">
                <v-layout
                  class="text--sub-title-1"
                  align-center
                >
                  Search results
                  <v-progress-circular
                    v-if="searchInProgress"
                    indeterminate
                    size="18"
                    width="2"
                    color="primary"
                    class="mx-3"
                  />
                  <v-btn
                    v-if="searchInProgress"
                    class="button-1"
                    small
                    @click="cancelSearchAllDrives({clearResults: false})"
                  >
                    stop
                  </v-btn>
                </v-layout>

                <!-- search-results::status -->
                <div>{{searchResultsStatus}}</div>
              </div>
            </div>

            <!-- widget::results -->
            <div
              v-show="searchResultsRecentDirItems.length === 0 && searchResults.length === 0"
              class="widget__info-container__results my-4"
              style="display: flex; align-items: center; justify-content: center; flex-direction: column"
            >
              <v-icon size="48px">
                mdi-magnify
              </v-icon>
              <div class="mt-2 text--sub-title-1">
                Search results
              </div>
            </div>

            <!-- widget::results -->
            <div
              v-show="query.length > 0 && (searchResultsRecentDirItems.length > 0 || searchResults.length > 0)"
              class="widget__info-container__results"
            >
              <!-- dir-items-container -->
              <div
                class="
                  custom-scrollbar
                  unselectable
                  drag-drop-container
                  dir-item-card__container
                  fade-mask--bottom
                "
                data-layout="list"
                data-type="directory"
                :style="{
                  '--fade-mask-bottom': '10%',
                  'height': '100%',
                }"
              >
                <div
                  v-if="optionIncludeRecent && storeDirItemOpenEvent && searchResultsRecentDirItems.length > 0"
                  class="mb-6"
                >
                  <div class="text--sub-title-1 ml-6">
                    Recent items
                  </div>
                  <dir-item
                    v-for="(item, index) in searchResultsRecentDirItems"
                    v-show="optionIncludeDirectories && item.type.includes('directory') || optionIncludeFiles && item.type.includes('file')"
                    :key="`recent-dir-item-${item.path}`"
                    :dir-item="item"
                    :index="index"
                    :type="item.type"
                    :show-dir="true"
                    :show-score="!true"
                  />
                </div>

                <div class="text--sub-title-1 ml-6">
                  Global items
                </div>
                <div v-show="!showDirectoriesOnTop">
                  <dir-item
                    v-for="(item, index) in searchResults"
                    v-show="optionIncludeDirectories && item.type.includes('directory') || optionIncludeFiles && item.type.includes('file')"
                    :key="`dir-item-${item.path}`"
                    :dir-item="item"
                    :index="index"
                    :type="item.type"
                    :show-dir="true"
                    :show-score="true"
                  />
                </div>

                <div v-show="showDirectoriesOnTop">
                  <!-- dir-items-container: {type: directory} -->
                  <dir-item
                    v-for="(item, index) in searchResultsDirectories"
                    v-show="optionIncludeDirectories && item.type.includes('directory')"
                    :key="`directory-dir-item-${item.path}`"
                    :dir-item="item"
                    :index="index"
                    :type="item.type"
                    :show-dir="true"
                    :show-score="true"
                  />

                  <!-- dir-items-container: {type: file} -->
                  <dir-item
                    v-for="(item, index) in searchResultsFiles"
                    v-show="optionIncludeFiles && item.type.includes('file')"
                    :key="`file-dir-item-${item.path}`"
                    :dir-item="item"
                    :index="index"
                    :type="item.type"
                    :show-dir="true"
                    :show-score="true"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- widget::options-container -->
          <div
            v-if="showWidgetOptions"
            class="widget__options-container custom-scrollbar fade-mask--bottom"
            :style="{
              '--fade-mask-bottom': '15%'
            }"
          >
            <div>
              <div class="text--sub-title-1">
                Drives
              </div>

              <!-- input-switch::search-all-drives -->
              <v-switch
                v-model="optionAllDrivesSelected"
                class="mt-1 mb-2"
                label="Search all drives"
                hide-details
                @change="selectAllDrives()"
              />

              <!-- input-select::drive-list-to-search -->
              <v-select
                v-if="!optionAllDrivesSelected"
                v-model="optionSelectedDrives"
                :items="drives"
                label="Select drives"
                item-text="titleSummary"
                menu-props="offsetY"
                return-object
                multiple
                hide-details
                @change="handleOptionValueChange()"
              >
                <template #selection="{ index }">
                  <span
                    v-if="index === 0"
                    class="grey--text caption"
                  >{{optionSelectedDrives.length}} drives selected
                  </span>
                </template>
              </v-select>
            </div>

            <div>
              <div class="text--sub-title-1">
                Results
              </div>
              <v-checkbox
                v-model="optionIncludeDirectories"
                class="mt-2"
                label="Show directories"
                hide-details
              />

              <v-checkbox
                v-model="optionIncludeFiles"
                class="mt-1"
                label="Show files"
                hide-details
              />

              <v-tooltip
                bottom
                :disabled="storeDirItemOpenEvent"
              >
                <template #activator="{ on }">
                  <div v-on="on">
                    <v-checkbox
                      v-model="optionIncludeRecent"
                      class="mt-2"
                      :disabled="!storeDirItemOpenEvent"
                      label="Show recent"
                      hide-details
                    />
                  </div>
                </template>
                <span>Statistics storing is disabled</span>
              </v-tooltip>
            </div>

            <div>
              <div class="text--sub-title-1">
                Options
              </div>

              <!-- input-checkbox::match-symbols -->
              <v-checkbox
                v-model="optionMatchSymbols"
                class="mt-2"
                label="Match symbols"
                hide-details
                @change="handleOptionValueChange()"
              />

              <v-tooltip bottom>
                <template #activator="{ on }">
                  <!-- input-checkbox::match-search-query-exactly -->
                  <div v-on="on">
                    <v-checkbox
                      v-model="optionExactMatch"
                      class="mt-2"
                      label="Match search query exactly"
                      hide-details
                      @change="handleOptionValueChange()"
                    />
                  </div>
                </template>
                <span>
                  Only the names that match query exactly will be found.
                  <br />The case doesn't matter. All words are transformed to lowercase.
                </span>
              </v-tooltip>

              <!-- input-checkbox::increased-typo-tolerance -->
              <v-checkbox
                v-model="optionIncreasedTypoTolerance"
                class="mt-2"
                label="Increased typo tolerance"
                hide-details
                @change="handleOptionValueChange()"
              />

              <!-- input-switch::show-directories-on-top -->
              <v-switch
                v-model="showDirectoriesOnTop"
                class="mt-4 mb-2"
                label="Show directories on top"
                hide-details
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import {mapState} from 'vuex'
import {search} from '@/utils/search.js'

const PATH = require('path')
const lodash = require('@/utils/lodash.min.js')

export default {
  data () {
    return {
      showWidgetOptions: true,
      showDirectoriesOnTop: false,
      minutesElapsedLastScan: 0,
      searchStartTime: 0,
      searchFinishTime: 0,
      searchTime: 0,
      previousQuery: '',
      lines: [],
      chunk: 0,
      lineCounter: 0,
      linesToProcess: 16384,
      readStream: null,
      readInterface: null,
      debounceTimeout: null,
      searchResults: [],
      searchResultsRecentDirItems: [],
      searchTasks: [],
      searchInfo: [],
      searchResultsItemsAmount: 50,
      searchResultsUpdateInterval: 3000,
    }
  },
  watch: {
    query (value) {
      if (value.length === 0) {
        this.searchResults = []
        this.cancelSearchAllDrives()
      }
    },
    widget (newValue) {
      if (newValue && this.$refs.globalSearchInput) {
        this.$nextTick(() => {
          this.$refs.globalSearchInput.focus()
        })
      }
      else {
        this.cancelSearchAllDrives()
      }
    },
  },
  destroyed () {
    this.$eventHub.$off('globalSearch:results', this.handleGlobalSearchResults)
    this.$eventHub.$off('globalSearch:info-update', this.handleGlobalSearchInfoUpdate)
  },
  mounted () {
    this.initWidget()
  },
  computed: {
    ...mapState({
      navigatorLayout: state => state.storageData.settings.navigatorLayout,
      navigatorLayoutItemHeight: state => state.storageData.settings.navigatorLayoutItemHeight,
      globalSearchCompressSearchData: state => state.storageData.settings.compressSearchData,
    }),
    ...mapFields({
      appPaths: 'storageData.settings.appPaths',
      inputState: 'inputState',
      drives: 'drives',
      dirItems: 'navigatorView.dirItems',
      globalSearch: 'globalSearch',
      query: 'globalSearch.query',
      widget: 'globalSearch.widget',
      scanInProgress: 'globalSearch.scanInProgress',
      searchScanWasInterrupted: 'storageData.settings.globalSearchScanWasInterrupted',
      searchInProgress: 'globalSearch.searchInProgress',
      lastScanTimeElapsed: 'globalSearch.lastScanTimeElapsed',
      lastSearchScanTime: 'storageData.settings.time.lastSearchScan',
      storeDirItemOpenEvent: 'storageData.settings.stats.storeDirItemOpenEvent',
      optionIncludeFiles: 'globalSearch.options.includeFiles',
      optionIncludeDirectories: 'globalSearch.options.includeDirectories',
      optionIncludeRecent: 'globalSearch.options.includeRecent',
      optionIncludeApps: 'globalSearch.options.includeApps',
      optionSelectedDrives: 'globalSearch.options.selectedDrives',
      optionAllDrivesSelected: 'globalSearch.options.allDrivesSelected',
      optionExactMatch: 'globalSearch.options.exactMatch',
      optionMatchSymbols: 'globalSearch.options.matchSymbols',
      optionIncreasedTypoTolerance: 'globalSearch.options.increasedTypoTolerance',
      globalSearchScanDepth: 'storageData.settings.globalSearchScanDepth',
      dirItemsTimeline: 'storageData.stats.dirItemsTimeline',
    }),
    formattedSearchResults () {
      return [...this.searchResults].forEach(item => {
        this.$store.dispatch('GET_DIR_ITEM_INFO', item.path)
          .then((formattedItem) => {
            return formattedItem
          })
      })
    },
    totalLinesProcessed () {
      let total = 0
      this.searchInfo.forEach(drive => {
        total += drive.linesProcessed
      })
      return total
    },
    searchResultsStatus () {
      let status = ''
      if (this.searchInProgress) {
        if (this.totalLinesProcessed) {
          status = `
            Searched paths: ${new Intl.NumberFormat().format(this.totalLinesProcessed)}
          `
        }
      }
      else if (!this.searchInProgress) {
        if ((this.searchResultsRecentDirItems.length > 0 || this.searchResults.length > 0) && this.searchTasks.length === 0) {
          status = `
            Found ${this.searchResults.length} items • 
            Finished in ${this.searchTime} seconds •
            Searched paths: ${new Intl.NumberFormat().format(this.totalLinesProcessed)} 
          `
        }
        if (this.searchResultsRecentDirItems.length === 0 && this.searchResults.length === 0 && this.query.length > 0) {
          status = 'Nothing was found'
        }
      }
      return status
    },
    searchResultsDirectories () {
      return this.searchResults.filter(item => item.type.includes('directory'))
    },
    searchResultsFiles () {
      return this.searchResults.filter(item => item.type.includes('file'))
    },
  },
  methods: {
    initWidget () {
      this.$eventHub.$on('globalSearch:results', this.handleGlobalSearchResults)
      this.$eventHub.$on('globalSearch:info-update', this.handleGlobalSearchInfoUpdate)
      if (this.optionAllDrivesSelected) {
        this.selectAllDrives()
      }
      if (this.$refs.globalSearchInput) {
        this.$refs.globalSearchInput.focus()
      }
    },
    async handleGlobalSearchResults (data) {
      if (!data.isCancelled) {
        if (data.isFinished) {
          // Remove task
          const taskIndex = this.searchTasks.findIndex(task => task.mount === data.mount)
          if (taskIndex !== -1) {
            this.searchTasks.splice(taskIndex, 1)
          }
        }
        // Get best search results
        // Note: separate files and directories to avoid situations where
        // one of the types has items with higher scores and the other type
        // is completely filtered out from the search results
        const driveSearchResults = await this.fetchItemInfoForSearchResults(data.searchResults)
        const driveSearchResultsFiles = driveSearchResults.filter(item => item.type.includes('file'))
        const driveSearchResultsDirectories = driveSearchResults.filter(item => item.type.includes('directory'))
        const currentSearchResultsFiles = this.searchResults.filter(item => item.type.includes('file'))
        const currentSearchResultsDirectories = this.searchResults.filter(item => item.type.includes('directory'))
        const bestSearchResultsFiles = this.getBestSearchItems([...currentSearchResultsFiles, ...driveSearchResultsFiles])
        const bestSearchResultsDirectories = this.getBestSearchItems([...currentSearchResultsDirectories, ...driveSearchResultsDirectories])
        let bestSearchResults = this.sort([...bestSearchResultsFiles, ...bestSearchResultsDirectories], 'score')
        // Remove duplicates
        bestSearchResults = lodash.uniqBy(bestSearchResults, 'path')
        // Set search results
        this.searchResults = bestSearchResults
        // Check if all searches are done
        if (this.searchTasks.length === 0) {
          this.searchInProgress = false
          this.searchFinishTime = Date.now()
          this.searchTime = ((this.searchFinishTime - this.searchStartTime) / 1000).toFixed(2)
        }
      }
    },
    async handleGlobalSearchInfoUpdate (data) {
      let drive = this.searchInfo.find(drive => drive.mount === data.mount)
      if (drive === undefined) {
        this.searchInfo.push(data)
        drive = this.searchInfo.find(drive => drive.mount === data.mount)
      }
      if (data.type === 'data') {
        drive.linesProcessed = data.linesProcessed
      }
    },
    selectAllDrives () {
      this.optionSelectedDrives = this.$utils.cloneDeep(this.drives)
      if (this.optionAllDrivesSelected) {
        this.handleOptionValueChange()
      }
    },
    handleInputKeyUp () {
      const sameQuery = this.query === this.previousQuery
      const emptyQuery = this.query.length === 0
      this.previousQuery = this.query
      if (!emptyQuery && !sameQuery) {
        clearTimeout(this.debounceTimeout)
        this.searchRecentDirItems()
        this.debounceTimeout = setTimeout(() => {
          this.updateSearch()
        }, 1000)
      }
    },
    handleOptionValueChange () {
      this.updateSearch()
    },
    cancelSearchAllDrives (params) {
      this.resetSearchData(params)
      this.appPaths.globalSearchDataFiles.forEach(file => {
        this.$eventHub.$emit('app:method', {
          method: 'initGlobalSearchWorkerAction',
          params: {
            action: 'cancel',
            mount: file.mount,
            path: file.path,
          },
        })
      })
    },
    resetSearchData (params) {
      const defaultParams = {
        clearResults: true,
      }
      params = {...defaultParams, ...params}
      this.searchInProgress = false
      this.searchInfo = []
      this.searchTasks = []
      if (params.clearResults) {
        this.searchResults = []
      }
    },
    updateSearch () {
      this.cancelSearchAllDrives()
      if (this.optionSelectedDrives.length === 0) {
        this.$eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'alert:global-search-no-drives-selected',
          closeButton: true,
          timeout: 2000,
          title: 'No drives selected',
          message: 'Select at least 1 drive for searching',
        })
        this.showWidgetOptions = true
        return
      }
      if (this.query.length > 0) {
        this.resetSearchData()
        this.startSearch()
      }
    },
    startSearch () {
      this.searchInProgress = true
      this.searchStartTime = Date.now()
      this.searchRecentDirItems()
      this.appPaths.globalSearchDataFiles.forEach(file => {
        const drive = this.optionSelectedDrives.some(drive => drive.mount === file.mount)
        if (drive) {
          const searchObject = {
            action: 'search',
            mount: file.mount,
            path: file.path,
            query: this.query,
            options: this.globalSearch.options,
            amount: this.searchResultsItemsAmount,
            searchResultsUpdateInterval: this.searchResultsUpdateInterval,
            compressSearchData: this.globalSearchCompressSearchData,
          }
          this.searchTasks.push(searchObject)
          this.$eventHub.$emit('app:method', {
            method: 'initGlobalSearchWorkerAction',
            params: searchObject,
          })
        }
      })
    },
    async searchRecentDirItems () {
      if (!this.storeDirItemOpenEvent) {return}
      let paths = this.dirItemsTimeline.map(item => item.path)
      let searchResults = search({
        list: paths,
        query: this.query,
        options: this.globalSearch.options,
      })
      let bestSearchResults = this.getBestSearchItems(searchResults)
      this.searchResultsRecentDirItems = await this.fetchItemInfoForSearchResults(bestSearchResults)
    },
    async fetchItemInfoForSearchResults (dirItemlist) {
      const formatted = []
      for (const dirItem of dirItemlist) {
        try {
          const formattedItem = await this.$store.dispatch('GET_DIR_ITEM_INFO', dirItem.path)
          formattedItem.score = dirItem.score
          formattedItem.dir = PATH.parse(dirItem.path).dir.replace(/\\/g, '/')
          formatted.push(formattedItem)
        }
        catch (error) {}
      }
      return formatted
    },
    getBestSearchItems (array) {
      return array
        .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
        .slice(0, this.searchResultsItemsAmount) // get the best N items
    },
    sort (array, key) {
      return array.sort((a, b) => parseFloat(b[key]) - parseFloat(a[key]))
    },
  },
}
</script>

<style scoped>
.widget__overlay--scan-in-progress {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: var(--bg-color-1);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.widget__container {
  margin: 24px;
  margin-bottom: 16px;
  background-color: var(--bg-color-1);
  position: relative;
}

.widget__main-container {
  display: flex;
  max-height: 45vh;
}

.widget__options-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 24px 36px 24px;
  max-width: 300px;
  overflow: auto;
  border-left: 1px solid var(--divider-color-2);
}

.widget__info-container {
  /* Stretch to 100% height of the container */
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
}

.widget__info-container__header {
  padding: 24px;
  padding-bottom: 12px;
}

.widget__info-container__results {
  padding-bottom: 12px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden !important;
}

.widget__info-container__results .v-icon {
  color: rgba(255,255,255,0.2) !important
}

.widget__input-container {
  background-color: rgb(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  position: relative;
}

.widget__input {
  width: 100%;
  height: 42px;
  padding-top: 0px;
  background: transparent;
  padding-left: 60px;
  border: 0px solid #b0bec5;
  color: var(--color-6);
  outline: none;
  caret-color: var(--color-6);
}

.widget__input__button[data-action="search-icon"] {
  position: absolute;
  left: 16px;
}

.widget__input__buttons-container {
  position: absolute;
  right: 8px;
  display: flex;
  pointer-events: none;
}

.widget__input__buttons-container .widget__input__button {
  pointer-events: initial;
  margin-right: 8px;
}

.widget__input__button[data-action="clear"] {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}

.widget__input__button[data-action="clear"][data-visible="true"] {
  opacity: 1;
  pointer-events: initial;
}

.widget__input:focus {
  /* METHOD 2 */
  /* padding-left: 15px;  */
  /* border-bottom: 2px solid #b0bec5; */
  border-width: 0 0 thin 0;
  border-color: var(--color-6);
  padding-top: 1px;
}

.widget__input::placeholder {
  color: var(--color-7);
  /* opacity: 0.5; */
}
</style>
