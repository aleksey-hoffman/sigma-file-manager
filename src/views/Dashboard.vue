<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div id="dashboard-route">
    <div
      id="content-area--dashboard-route"
      class="content-area custom-scrollbar"
    >
      <v-layout
        align-center
        justify-space-between
        class="mb-4"
      >
        <div class="text--title-1">
          Dashboard
        </div>
        <filter-field ref="filterField" />
      </v-layout>

      <v-tabs
        v-model="dashboardSelectedTab"
        height="36"
        show-arrows="mobile"
      >
        <v-tab
          v-for="(tab, index) in dashboard.tabs"
          v-show="tab.show"
          :key="index"
        >
          <v-icon
            size="18"
            class="mr-2"
          >
            {{tab.icon}}
          </v-icon>
          {{tab.title}}
        </v-tab>
      </v-tabs>
      <v-divider class="divider-color-2 mb-4" />

      <v-tabs-items
        v-model="dashboardSelectedTab"
        class="mb-6"
      >
        <!-- tab-item:pinned -->
        <v-tab-item>
          <v-menu offset-y>
            <template #activator="{ on: menu, attrs }">
              <v-tooltip
                bottom
                :disabled="attrs['aria-expanded'] === 'true'"
              >
                <template #activator="{ on: tooltip }">
                  <v-btn
                    v-bind="attrs"
                    class="button-1 mb-4"
                    small
                    v-on="{ ...tooltip, ...menu }"
                  >
                    <v-icon
                      size="22px"
                      class="mr-3"
                    >
                      mdi-menu-down
                    </v-icon>
                    Options
                  </v-btn>
                </template>
                <span>Actions</span>
              </v-tooltip>
            </template>
            <v-list>
              <v-list-item
                @click="$store.dispatch('CLEAR_PINNED')"
              >
                <v-list-item-action>
                  <v-icon
                    class="ml-2"
                    size="16px"
                  >
                    mdi-close
                  </v-icon>
                </v-list-item-action>
                <v-list-item-title>Remove all from this list</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>

          <!-- list:pinned:directories -->
          <dir-item
            v-for="(item, index) in filteredPinnedItemsDirectories"
            :key="`pinned-directory-item-${item.path}`"
            :source="item"
            layout="list"
            :index="index"
            :type="item.type"
            :show-dir="true"
            :thumb-loading-is-paused="false"
            :force-thumb-load="false"
            :status="{
              itemHover: {
                isPaused: false
              }
            }"
          >
            <template #actions>
              <v-btn icon>
                <v-icon
                  @dblclick.prevent.stop=""
                  @click.prevent.stop="$store.dispatch(
                    'REMOVE_FROM_PINNED',
                    { items: [item] }
                  )"
                >
                  mdi-close
                </v-icon>
              </v-btn>
            </template>
          </dir-item>

          <!-- list:pinned:files -->
          <dir-item
            v-for="(item, index) in filteredPinnedItemsFiles"
            :key="`pinned-file-item-${item.path}`"
            :source="item"
            layout="list"
            :index="index"
            :type="item.type"
            :show-dir="true"
            :thumb-loading-is-paused="false"
            :force-thumb-load="false"
            :status="{
              itemHover: {
                isPaused: false
              }
            }"
          >
            <template #actions>
              <v-btn icon>
                <v-icon
                  @dblclick.prevent.stop=""
                  @click.prevent.stop="$store.dispatch(
                    'REMOVE_FROM_PINNED',
                    { items: [item] }
                  )"
                >
                  mdi-close
                </v-icon>
              </v-btn>
            </template>
          </dir-item>

          <!-- no-data -->
          <div v-show="pinnedItems.length === 0">
            <div class="title">
              No data
            </div>
            <div>
              Pinned directory items will be shown here
            </div>
          </div>
        </v-tab-item>

        <!-- tab-item:protected -->
        <v-tab-item>
          <v-menu offset-y>
            <template #activator="{ on: menu, attrs }">
              <v-tooltip
                bottom
                :disabled="attrs['aria-expanded'] === 'true'"
              >
                <template #activator="{ on: tooltip }">
                  <v-btn
                    v-bind="attrs"
                    class="button-1 mb-4"
                    small
                    v-on="{ ...tooltip, ...menu }"
                  >
                    <v-icon
                      size="22px"
                      class="mr-3"
                    >
                      mdi-menu-down
                    </v-icon>
                    Options
                  </v-btn>
                </template>
                <span>Actions</span>
              </v-tooltip>
            </template>
            <v-list>
              <v-list-item
                @click="$store.dispatch('CLEAR_PROTECTED')"
              >
                <v-list-item-action>
                  <v-icon
                    class="ml-2"
                    size="16px"
                  >
                    mdi-close
                  </v-icon>
                </v-list-item-action>
                <v-list-item-title>Remove all from this list</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>

          <!-- dir-item-list:protected:directories -->
          <dir-item
            v-for="(item, index) in filteredProtectedItemsDirectories"
            :key="`protected-directory-item-${item.path}`"
            :source="item"
            layout="list"
            :index="index"
            :type="item.type"
            :show-dir="true"
            :thumb-loading-is-paused="false"
            :force-thumb-load="false"
            :status="{
              itemHover: {
                isPaused: false
              }
            }"
          >
            <template #actions>
              <v-btn icon>
                <v-icon
                  @dblclick.prevent.stop=""
                  @click.prevent.stop="$store.dispatch(
                    'REMOVE_FROM_PROTECTED',
                    { items: [item] }
                  )"
                >
                  mdi-close
                </v-icon>
              </v-btn>
            </template>
          </dir-item>

          <!-- dir-item-list:protected:files -->
          <dir-item
            v-for="(item, index) in filteredProtectedItemsFiles"
            :key="`protected-file-item-${item.path}`"
            :source="item"
            layout="list"
            :index="index"
            :type="item.type"
            :show-dir="true"
            :thumb-loading-is-paused="false"
            :force-thumb-load="false"
            :status="{
              itemHover: {
                isPaused: false
              }
            }"
          >
            <template #actions>
              <v-btn icon>
                <v-icon
                  @dblclick.prevent.stop=""
                  @click.prevent.stop="$store.dispatch(
                    'REMOVE_FROM_PROTECTED',
                    { items: [item] }
                  )"
                >
                  mdi-close
                </v-icon>
              </v-btn>
            </template>
          </dir-item>

          <!-- no-data -->
          <div v-show="protectedItems.length === 0">
            <div class="title">
              No data
            </div>
            <div>
              Protected directory items will be shown here
            </div>
          </div>
        </v-tab-item>

        <!-- tab-item:timeline -->
        <v-tab-item v-show="dashboard.tabs.timeline.show">
          <v-menu offset-y>
            <template #activator="{ on: menu, attrs }">
              <v-tooltip
                bottom
                :disabled="attrs['aria-expanded'] === 'true'"
              >
                <template #activator="{ on: tooltip }">
                  <v-btn
                    v-show="stats.storeDirItemOpenEvent"
                    class="button-1 mb-4"
                    v-bind="attrs"
                    small
                    v-on="{ ...tooltip, ...menu }"
                  >
                    <v-icon
                      size="22px"
                      class="mr-3"
                    >
                      mdi-menu-down
                    </v-icon>
                    Options
                  </v-btn>
                </template>
                <span>Actions</span>
              </v-tooltip>
            </template>
            <v-list>
              <v-list-item
                @click="$store.dispatch('CLEAR_DIR_ITEMS_TIMELINE')"
              >
                <v-list-item-action>
                  <v-icon
                    class="ml-2"
                    size="16px"
                  >
                    mdi-close
                  </v-icon>
                </v-list-item-action>
                <v-list-item-title>Remove all from this list</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>

          <div
            v-for="(groupItem, index) in dirItemsTimelineGroups"
            :key="'item-' + index"
          >
            <div class="text--sub-title-1 mt-2">
              {{groupItem.title}}
            </div>

            <dir-item
              v-for="(item, index) in groupItem.items"
              :key="`dir-items-timeline-group-item-${index}`"
              :source="item"
              layout="list"
              :index="index"
              :type="item.type"
              :show-dir="true"
              :thumb-loading-is-paused="false"
              :force-thumb-load="false"
              :status="{
                itemHover: {
                  isPaused: false
                }
              }"
            >
              <template #actions>
                <v-btn icon>
                  <v-icon
                    @dblclick.prevent.stop=""
                    @click.prevent.stop="$store.dispatch(
                      'REMOVE_FROM_DIR_ITEMS_TIMELINE',
                      {items: [item]}
                    )"
                  >
                    mdi-close
                  </v-icon>
                </v-btn>
              </template>
            </dir-item>
          </div>

          <!-- no-data -->
          <div v-show="!stats.storeDirItemOpenEvent">
            <div>
              This feature is disabled.
              <br />The app doesn't store statistics of your interactions with directories / files.
              <br />Enable the option called <span class="inline-code--light">"Store the list of opened directory items"</span> in the "Stats" section of settings:
            </div>
            <v-btn
              class="button-1 mt-4"
              small
              @click="$router.push('settings')"
            >
              Open settings
            </v-btn>
          </div>

          <div v-show="stats.storeDirItemOpenEvent && dirItemsTimeline.length === 0">
            <div class="title">
              No data
            </div>
            <div>
              Opened directory items will be shown here
            </div>
          </div>
        </v-tab-item>
      </v-tabs-items>
    </div>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import itemFilter from '../utils/itemFilter'
const PATH = require('path')

export default {
  name: 'dashboard',
  data () {
    return {
      fetchedData: {
        pinnedItems: [],
        protectedItems: [],
        dirItemsTimeline: [],
      },
    }
  },
  beforeRouteLeave (to, from, next) {
    this.$store.dispatch('SAVE_ROUTE_SCROLL_POSITION', {
      toRoute: to,
      fromRoute: from,
    })
    next()
  },
  activated () {
    this.$store.dispatch('ROUTE_ACTIVATED_HOOK_CALLBACK', {
      route: 'dashboard',
    })
  },
  async mounted () {
    this.$store.dispatch('ROUTE_MOUNTED_HOOK_CALLBACK', {
      route: 'dashboard',
    })
    await this.fetchDataObjects()
  },
  watch: {
    pinnedItems () {
      this.fetchDataObjects()
    },
    protectedItems () {
      this.fetchDataObjects()
    },
    dirItemsTimeline () {
      this.fetchDataObjects()
    },
  },
  computed: {
    ...mapFields({
      dialogs: 'dialogs',
      pinnedItems: 'storageData.pinned.items',
      protectedItems: 'storageData.protected.items',
      dirItemsTimeline: 'storageData.stats.dirItemsTimeline',
      dirItemsTimelineGroups: 'storageData.stats.dirItemsTimelineGroups',
      stats: 'storageData.settings.stats',
      dashboard: 'storageData.settings.dashboard',
      filterQuery: 'filterField.view.dashboard.query',
      dashboardSelectedTab: 'storageData.settings.dashboard.selectedTab',
      navigatorShowHiddenDirItems: 'storageData.settings.navigator.showHiddenDirItems',
    }),
    pinnedItemsMatchingFilter () {
      return this.getItemsMatchingFilter(this.fetchedData.pinnedItems)
    },
    filteredPinnedItemsDirectories () {
      return this.pinnedItemsMatchingFilter.filter(item => item.type === 'directory')
    },
    filteredPinnedItemsFiles () {
      return this.pinnedItemsMatchingFilter.filter(item => item.type === 'file')
    },
    protectedItemsMatchingFilter () {
      return this.getItemsMatchingFilter(this.fetchedData.protectedItems)
    },
    filteredProtectedItemsDirectories () {
      return this.protectedItemsMatchingFilter.filter(item => item.type === 'directory')
    },
    filteredProtectedItemsFiles () {
      return this.protectedItemsMatchingFilter.filter(item => item.type === 'file')
    },
    // Note: causes Vue node update error:
    // Error in nextTick: "NotFoundError: Failed to execute 'insertBefore' on 'Node'
    filteredDirItemsTimelineGroups () {
      const clonedGroups = this.$utils.cloneDeep(this.dirItemsTimelineGroups)
      for (const [key, value] of Object.entries(clonedGroups)) {
        value.items = this.getItemsMatchingFilter(value.items)
      }
      return clonedGroups
    },
  },
  methods: {
    getItemsMatchingFilter (items) {
      return itemFilter({
        filterQuery: this.filterQuery,
        items,
        filterHiddenItems: this.navigatorShowHiddenDirItems,
        filterProperties: this.$store.state.filterField.view[this.$route.name].filterProperties,
        filterQueryOptions: this.$store.state.filterField.view[this.$route.name].options,
      })
    },
    async fetchItemDataObject (data) {
      try {
        return await this.$store.dispatch(
          'CONVERT_OBJECTS_TO_DATA_OBJECTS',
          {items: data},
        )
      }
      catch (error) {
        throw Error(error)
      }
    },
    async fetchDataObjects () {
      this.fetchedData.pinnedItems = await this.fetchItemDataObject(this.pinnedItems)
      this.fetchedData.protectedItems = await this.fetchItemDataObject(this.protectedItems)
      this.fetchedData.dirItemsTimeline = await this.fetchItemDataObject(this.dirItemsTimeline)
      this.dirItemsTimelineGroups = await this.groupTimelineItems(this.fetchedData.dirItemsTimeline)
    },
    async groupTimelineItems (items) {
      const formattedItems = await this.formattedTimelineItems(items)
      const groups = {}

      formattedItems.forEach((item) => {
        const currentDate = this.$utils.formatDateTime(new Date().getTime(), 'D MMM YYYY')
        const itemOpenDate = this.$utils.formatDateTime(item.openDate, 'D MMM YYYY')
        const dateIsToday = currentDate === itemOpenDate
        if (groups[itemOpenDate]) {
          groups[itemOpenDate].title = dateIsToday
            ? `${itemOpenDate} (today)`
            : itemOpenDate
          groups[itemOpenDate].items.push(item)
        }
        else {
          groups[itemOpenDate] = {
            title: itemOpenDate,
            items: [item],
          }
        }
      })

      return groups
    },
    async formattedTimelineItems (items) {
      return items.map(item => {
        item.dir = PATH.parse(item.path).dir.replace(/\\/g, '/')
        return item
      })
    },
  },
}
</script>
