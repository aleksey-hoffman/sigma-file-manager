<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <transition name="slide-fade-left">
    <div
      v-show="widget"
      class="search-widget"
    >
      <div
        class="search-widget__container"
        shadow="x3"
      >
        <!-- widget::overlays -->
        <div
          v-show="!globalSearchIsEnabled"
          class="search-widget__overlay--scan-in-progress"
        >
          <v-layout
            column
            align-center
            justify-center
            class="title"
          >
            {{$t('globalSearch.globalSearchDisabled')}}
            <v-btn
              class="button-1 mt-4"
              @click="$store.dispatch('SET', {
                key: 'storageData.settings.globalSearchIsEnabled',
                value: true
              })"
            >
              {{$t('enable')}}
            </v-btn>
          </v-layout>
        </div>
        <div
          v-show="scanInProgress"
          class="search-widget__overlay--scan-in-progress"
        >
          <v-layout
            column
            align-center
            justify-center
            class="title"
          >
            {{$t('globalSearch.driveScanInProgress')}}
          </v-layout>
        </div>
        <div
          v-show="searchScanWasInterrupted && !scanInProgress && globalSearchIsEnabled"
          class="search-widget__overlay--scan-in-progress"
        >
          <v-layout
            column
            align-center
            justify-center
          >
            <div class="title">
              {{$t('globalSearch.driveScanInterrupted')}}
            </div>
            <div>
              {{$t('globalSearch.searchDataIncomplete')}}
            </div>
            <v-btn
              small
              class="button-1 mt-2"
              @click="$eventHub.$emit('app:method', {
                method: 'initGlobalSearchDataScan'
              })"
            >
              {{$t('globalSearch.reScanDrives')}}
            </v-btn>
          </v-layout>
        </div>

        <!-- widget::toolbar -->
        <div class="search-widget__input-container">
          <v-btn
            small
            icon
            data-action="search-icon"
            class="search-widget__input__button"
          >
            <v-icon class="action-toolbar__icon">
              mdi-magnify
            </v-icon>
          </v-btn>
          <input
            ref="globalSearchInput"
            v-model="query"
            :placeholder="$t('search')"
            :disabled="scanInProgress || !globalSearchIsEnabled"
            hide-details
            single-line
            flat
            box
            class="search-widget__input"
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

          <div class="search-widget__input__buttons-container">
            <!-- button:clear-search-input -->
            <div
              class="search-widget__input__button"
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
                <span>{{$t('globalSearch.clearSearchField')}}</span>
              </v-tooltip>
            </div>

            <!-- button:toggle-options -->
            <div
              class="search-widget__input__button"
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
                    ? $t('globalSearch.hideOptions')
                    : $t('globalSearch.showOptions')}}
                </span>
              </v-tooltip>
            </div>

            <!-- button:close-widget -->
            <div
              class="search-widget__input__button"
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
                <span>{{$t('globalSearch.closeGlobalSearch')}}</span>
              </v-tooltip>
            </div>
          </div>
        </div>

        <div class="search-widget__main-container">
          <!-- widget::info-container -->
          <transition name="slide-fade-up-200ms">
            <div
              v-show="!showWidgetOptions"
              class="search-widget__info-container custom-scrollbar"
            >
              <div class="search-widget__info-container__header">
                <div v-show="query.length === 0">
                  <v-layout
                    align-center
                    justify-space-between
                    class="text--sub-title-1"
                  >
                    {{$t('globalSearch.searchData')}}
                    <!-- button:re-scan -->
                    <v-btn
                      class="button-1"
                      small
                      @click="$eventHub.$emit('app:method', {
                        method: 'initGlobalSearchDataScan'
                      })"
                    >
                      {{$t('globalSearch.reScanDrives')}}
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
                      {{$t('globalSearch.scanDepth')}}: {{$t('count.directories', {n: globalSearchScanDepth})}}
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
                    {{$t('globalSearch.searchResults')}}
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
                      {{$t('stop')}}
                    </v-btn>
                  </v-layout>

                  <!-- search-results::status -->
                  <div class="search-widget__info-container-search-results-status">
                    {{searchResultsStatus}}
                  </div>
                </div>
              </div>

              <!-- widget::results -->
              <div
                v-show="searchResultsRecentDirItems.length === 0 && searchResults.length === 0"
                class="search-widget__info-container__results my-4"
                style="display: flex; align-items: center; justify-content: center; flex-direction: column"
              >
                <v-icon size="48px">
                  mdi-magnify
                </v-icon>
                <div class="mt-2 text--sub-title-1">
                  {{$t('globalSearch.searchResults')}}
                </div>
              </div>

              <!-- widget::results -->
              <div
                v-show="query.length > 0 && (searchResultsRecentDirItems.length > 0 || searchResults.length > 0)"
                class="search-widget__info-container__results"
              >
                <!-- dir-items-container -->
                <div
                  class="
                    unselectable
                    drag-drop-container
                    dir-item-card__container
                  "
                  data-layout="list"
                  data-type="directory"
                  :style="{
                    'height': '100%',
                  }"
                >
                  <div
                    v-if="optionIncludeRecent && storeDirItemOpenEvent && searchResultsRecentDirItems.length > 0"
                    class="mb-6"
                  >
                    <div class="text--sub-title-1 ml-6">
                      {{$t('globalSearch.recentItems')}}
                    </div>
                    <dir-item
                      v-for="(item, index) in searchResultsRecentDirItems"
                      v-show="optionIncludeDirectories && item.type.includes('directory') || optionIncludeFiles && item.type.includes('file')"
                      :key="`recent-dir-item-${item.path}`"
                      layout="list"
                      :dir-item="item"
                      :index="index"
                      :type="item.type"
                      :show-dir="true"
                      :show-score="false"
                    />
                  </div>

                  <div class="text--sub-title-1 ml-6">
                    {{$t('globalSearch.globalItems')}}
                  </div>
                  <div v-show="!showDirectoriesOnTop">
                    <dir-item
                      v-for="(item, index) in searchResults"
                      v-show="optionIncludeDirectories && item.type.includes('directory') || optionIncludeFiles && item.type.includes('file')"
                      :key="`dir-item-${item.path}`"
                      layout="list"
                      :dir-item="item"
                      :index="index"
                      :type="item.type"
                      :show-dir="true"
                      :show-score="false"
                    />
                  </div>

                  <div v-show="showDirectoriesOnTop">
                    <!-- dir-items-container: {type: directory} -->
                    <dir-item
                      v-for="(item, index) in searchResultsDirectories"
                      v-show="optionIncludeDirectories && item.type.includes('directory')"
                      :key="`directory-dir-item-${item.path}`"
                      layout="list"
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
                      layout="list"
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
          </transition>

          <!-- widget::options-container -->
          <div
            v-if="showWidgetOptions"
            class="search-widget__options-container custom-scrollbar fade-mask--bottom"
            :style="{
              '--fade-mask-bottom': '15%'
            }"
          >
            <div>
              <div class="text--sub-title-1">
                {{$t('drives')}}
              </div>

              <!-- input-switch::search-all-drives -->
              <v-switch
                v-model="optionAllDrivesSelected"
                class="mt-1 mb-2"
                :label="$t('globalSearch.searchAllDrives')"
                hide-details
                @change="selectAllDrives()"
              />

              <!-- input-select::drive-list-to-search -->
              <v-select
                v-if="!optionAllDrivesSelected"
                v-model="optionSelectedDrives"
                :items="drives"
                :label="$t('globalSearch.selectDrives')"
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
                  >
                    {{$t('count.drivesSelected', {n: optionSelectedDrives.length})}}
                  </span>
                </template>
              </v-select>
            </div>

            <div>
              <div class="text--sub-title-1">
                {{$t('results')}}
              </div>
              <v-checkbox
                v-model="optionIncludeDirectories"
                class="mt-2"
                :label="$t('globalSearch.showDirectories')"
                hide-details
              />

              <v-checkbox
                v-model="optionIncludeFiles"
                class="mt-1"
                :label="$t('globalSearch.showFiles')"
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
                      :label="$t('globalSearch.showRecent')"
                      hide-details
                    />
                  </div>
                </template>
                <span>{{$t('globalSearch.statsStoringDisabled')}}</span>
              </v-tooltip>
            </div>

            <div>
              <div class="text--sub-title-1">
                {{$t('options')}}
              </div>

              <!-- input-checkbox::match-symbols -->
              <v-checkbox
                v-model="optionMatchSymbols"
                class="mt-2"
                :label="$t('globalSearch.matchSymbols')"
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
                      :label="$t('globalSearch.matchSearchQueryExactly')"
                      hide-details
                      @change="handleOptionValueChange()"
                    />
                  </div>
                </template>
                <span>
                  {{$t('globalSearch.onlyNamesMatchQuery')}}
                  <br />{{$t('globalSearch.caseDoesntMatter')}}
                </span>
              </v-tooltip>

              <!-- input-checkbox::increased-typo-tolerance -->
              <v-checkbox
                v-model="optionIncreasedTypoTolerance"
                class="mt-2"
                :label="$t('globalSearch.increasedTypoTolerance')"
                hide-details
                @change="handleOptionValueChange()"
              />

              <!-- input-switch::show-directories-on-top -->
              <v-switch
                v-model="showDirectoriesOnTop"
                class="mt-4 mb-2"
                :label="$t('globalSearch.showDirectoriesOnTop')"
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
      showWidgetOptions: false,
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
      recentSearchResultsScoreTreshold: 0.5,
      recentSearchResultsItemsAmount: 5,
      searchResultsItemsAmount: 50,
      searchResultsUpdateInterval: 3000,
    }
  },
  watch: {
    scanInProgress (value) {
      if (value) {
        this.searchResults = []
        this.cancelSearchAllDrives()
      }
    },
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
      globalSearchIsEnabled: 'storageData.settings.globalSearchIsEnabled',
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
            ${this.$tc('globalSearch.searchStats.found', this.searchResults.length)} • 
            ${this.$t('globalSearch.searchStats.finished', {n: this.searchTime})} •
            ${this.$t('globalSearch.searchStats.searched', {n: new Intl.NumberFormat().format(this.totalLinesProcessed)})} 
          `
        }
        if (this.searchResultsRecentDirItems.length === 0 && this.searchResults.length === 0 && this.query.length > 0) {
          status = this.$t('globalSearch.searchStats.nothingFound')
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
          title: this.$t('globalSearch.searchStats.noDrivesSelected'),
          message: this.$t('globalSearch.searchStats.selectAtLeastOneDrive'),
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
      let bestSearchResults = this.getBestSearchItems(searchResults, this.recentSearchResultsItemsAmount)
        .filter(item => item.score > this.recentSearchResultsScoreTreshold)
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
    getBestSearchItems (array, amount) {
      return array
        .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
        .slice(0, amount || this.searchResultsItemsAmount) // get the best N items
    },
    sort (array, key) {
      return array.sort((a, b) => parseFloat(b[key]) - parseFloat(a[key]))
    },
  },
}
</script>

<style scoped>
.search-widget__overlay--scan-in-progress {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: var(--bg-color-1);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-widget__container {
  position: relative;
  margin-bottom: 16px;
  background-color: var(--highlight-color-5);
}

.search-widget__main-container {
  display: block;
}

.search-widget__options-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(
    100vh -
    var(--window-toolbar-height) -
    var(--action-toolbar-height) -
    var(--workspace-area-toolbar-height)
  );
  padding: 16px 24px 36px 24px;
  overflow-y: auto;
}

.search-widget__info-container {
  /* Stretch to 100% height of the container */
  width: 100%;
  height: calc(
    100vh -
    var(--window-toolbar-height) -
    var(--action-toolbar-height) -
    var(--workspace-area-toolbar-height)
  );
  overflow-y: auto;
}

.search-widget__info-container__header {
  padding: 16px 24px;
}

.search-widget__info-container-search-results-status {
  font-size: 12px;
}

.search-widget__info-container__results {
  padding-bottom: 12px;
  overflow-y: auto;
  overflow-x: hidden !important;
}

.search-widget__info-container__results .v-icon {
  color: rgba(255,255,255,0.2) !important
}

.search-widget__input-container {
  background-color: rgb(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  position: relative;
}

.search-widget__input {
  width: 100%;
  height: var(--workspace-area-toolbar-height);
  padding-top: 0px;
  background: transparent;
  padding-left: 60px;
  border: 0px solid #b0bec5;
  color: var(--color-6);
  outline: none;
  caret-color: var(--color-6);
}

.search-widget__input__button[data-action="search-icon"] {
  position: absolute;
  left: 16px;
}

.search-widget__input__buttons-container {
  position: absolute;
  right: 8px;
  display: flex;
  pointer-events: none;
}

.search-widget__input__buttons-container .search-widget__input__button {
  pointer-events: initial;
  margin-right: 8px;
}

.search-widget__input__button[data-action="clear"] {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}

.search-widget__input__button[data-action="clear"][data-visible="true"] {
  opacity: 1;
  pointer-events: initial;
}

.search-widget__input:focus {
  border-width: 0 0 thin 0;
  border-color: var(--color-6);
  padding-top: 1px;
}

.search-widget__input::placeholder {
  color: var(--color-7);
}
</style>
