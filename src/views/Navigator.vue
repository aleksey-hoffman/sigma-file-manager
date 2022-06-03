<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div id="navigator-route">
    <info-panel />
    <div
      id="content-area"
      :clipboard-toolbar-visible="clipboardToolbarIsVisible"
      class="content-area fade-in-1s"
    >
      <div
        class="workspace__area__container"
        columns_1
      >
        <div class="workspace__area">
          <!-- workspace-area::toolbar -->
          <v-layout
            align-center
            class="workspace-area__header"
          >
            <!-- button::current-directory-context-menu -->
            <v-tooltip bottom>
              <template #activator="{ on }">
                <v-btn
                  icon
                  class="workspace-area-toolbar__item"
                  v-on="on"
                  @click="toggleCurrentDirContextMenu($event)"
                >
                  <v-icon
                    class="action-toolbar__icon"
                    size="32px"
                  >
                    mdi-menu-down
                  </v-icon>
                </v-btn>
              </template>
              <span>Current directory context menu</span>
            </v-tooltip>

            <!-- button::go-backward-in-history -->
            <v-tooltip bottom>
              <template #activator="{ on }">
                <v-btn
                  icon
                  class="workspace-area-toolbar__item"
                  v-on="on"
                  @click="$store.dispatch('LOAD_PREVIOUS_HISTORY_PATH')"
                >
                  <v-icon
                    class="action-toolbar__icon"
                    size="20px"
                  >
                    mdi-arrow-left
                  </v-icon>
                </v-btn>
              </template>
              <span>History | open previous directory</span>
            </v-tooltip>

            <!-- button::go-forward-in-history -->
            <v-tooltip bottom>
              <template #activator="{ on }">
                <v-btn
                  icon
                  class="workspace-area-toolbar__item"
                  v-on="on"
                  @click="$store.dispatch('LOAD_NEXT_HISTORY_PATH')"
                >
                  <v-icon
                    class="action-toolbar__icon"
                    size="20px"
                  >
                    mdi-arrow-right
                  </v-icon>
                </v-btn>
              </template>
              <span>History | open next directory</span>
            </v-tooltip>

            <!-- button::go-up-directory -->
            <v-tooltip bottom>
              <template #activator="{ on }">
                <v-btn
                  icon
                  class="workspace-area-toolbar__item"
                  v-on="on"
                  @click="$store.dispatch('GO_UP_DIRECTORY')"
                >
                  <v-icon
                    class="action-toolbar__icon"
                    size="20px"
                  >
                    mdi-arrow-up
                  </v-icon>
                </v-btn>
              </template>
              <span>Go up directory</span>
            </v-tooltip>

            <!-- button::reload -->
            <v-tooltip bottom>
              <template #activator="{ on }">
                <v-btn
                  icon
                  class="workspace-area-toolbar__item"
                  v-on="on"
                  @click="$store.dispatch('RELOAD_DIR', {
                    scrollTop: false,
                    emitNotification: true
                  })"
                >
                  <v-icon
                    class="action-toolbar__icon"
                    size="20px"
                  >
                    mdi-refresh
                  </v-icon>
                </v-btn>
              </template>
              <span>Reload current directory</span>
            </v-tooltip>

            <address-bar />
            <v-spacer />
            <filter-field />
          </v-layout>

          <sorting-header v-if="navigatorSortingElementDisplayType === 'bar'" />

          <div
            v-if="filterQuery.length > 0"
            class="content__description"
          >
            <v-btn
              small
              class="mt-5 mx-6 button-1"
              @click="filterQuery = ''"
            >
              <v-icon
                size="16px"
                class="mr-2"
              >
                mdi-backspace-outline
              </v-icon>
              Clear filter
            </v-btn>
          </div>

          <global-search v-show="globalSearchWidget" />
          <workspace-area-content />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import {mapGetters} from 'vuex'

export default {
  name: 'navigator',
  data () {
    return {
      processedDirItemsIndexes: [],
      dirItemAwaitsSecondClick: false,
      dirItemAwaitsSecondClickTimeout: null,
      dirItemSecondClickDelay: 500,
    }
  },
  beforeRouteLeave (to, from, next) {
    this.$store.dispatch('SAVE_ROUTE_SCROLL_POSITION', {
      toRoute: to,
      fromRoute: from,
    })
    next()
  },
  watch: {
    // dirItemsInfoIsFetched (value) {
    //   if (value === true) {
    //     // Use nextTick so it works the first time component loads
    //     this.$nextTick(() => {

    //     })
    //   }
    // },
    selectedDirItems (value) {
      // Hide context menu when all selected items get
      // deselected (and the current dir gets selected automatically)
      // so that the context menu does not remain displayed for the
      // deselected items
      if (this.isOnlyCurrentDirItemSelected) {
        this.contextMenus.dirItem.value = false
      }
    },
    'navigatorView.selectedDirItems' (value) {
      this.contextMenus.dirItem.value = false
    },
  },
  activated () {
    this.$store.dispatch('ROUTE_ACTIVATED_HOOK_CALLBACK', {
      route: 'navigator',
    })
  },
  async mounted () {
    this.setSortingTypes()
    this.$nextTick(() => {
      this.$store.dispatch('ROUTE_MOUNTED_HOOK_CALLBACK', {
        route: 'navigator',
      })
      this.navigatorRouteIsLoaded = true
    })
  },
  beforeDestroy () {
    this.navigatorRouteIsLoaded = false
  },
  computed: {
    ...mapGetters([
      'selectedWorkspace',
      'selectedDirItems',
      'clipboardToolbarIsVisible',
      'isOnlyCurrentDirItemSelected',
    ]),
    ...mapFields({
      focusedField: 'focusedField',
      contextMenus: 'contextMenus',
      dirItems: 'navigatorView.dirItems',
      navigatorRouteIsLoaded: 'navigatorRouteIsLoaded',
      visibleDirItems: 'navigatorView.visibleDirItems',
      autoCalculateDirSize: 'storageData.settings.autoCalculateDirSize',
      globalSearchWidget: 'globalSearch.widget',
      filterQuery: 'filterField.view.navigator.query',
      filterOptions: 'filterField.view.navigator.options',
      currentDir: 'navigatorView.currentDir',
      dirItemsInfoIsFetched: 'navigatorView.dirItemsInfoIsFetched',
      pinnedItems: 'storageData.pinned.items',
      sortingOrder: 'sorting.order',
      selectedSortingType: 'sorting.selectedType',
      sortingTypes: 'sorting.types',
      navigatorSortingElementDisplayType: 'storageData.settings.navigator.sorting.elementDisplayType',
    }),
  },
  methods: {
    toggleCurrentDirContextMenu (payload) {
      this.$store.dispatch('DESELECT_ALL_DIR_ITEMS')
      this.$store.dispatch('ADD_TO_SELECTED_DIR_ITEMS', this.currentDir)
        .then(() => {
          this.$store.dispatch('SET_CONTEXT_MENU', {
            value: 'toggle',
            x: payload.clientX,
            y: payload.clientY,
          })
        })
    },
    setSortingTypes () {
      let sortingTypesClone = this.sortingTypes.map(displayedType => {
        displayedType.onClick = (item) => this.handleSortHeaderItemClick(item)
        displayedType.type = 'sort'
        return displayedType
      })

      this.sortingTypes = sortingTypesClone
    },
    handleSortHeaderItemClick (item) {
      if (this.selectedSortingType.name === item.name) {
        this.$store.dispatch('TOGGLE_SORTING_ORDER')
      }
      else {
        this.$store.dispatch('SET_SORTING_TYPE', item)
      }
    },
  },
}
</script>

<style>
.workspace__area__container[columns_2] {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.workspace__area__container[columns_1] {
  display: grid;
  grid-template-columns: 1fr;
}

.workspace__area:nth-child(2) {
  border-left: 1px solid var(--dir-item-card-border);
}

.workspace__area {
  display: grid;
  grid-template-rows: 48px 36px 1fr;
}

.workspace-area__header {
  display: flex;
  align-items: center;
  gap: var(--toolbar-item-gap);
  height: var(--workspace-area-toolbar-height);
  margin: 0px;
  margin-bottom: 0px;
  padding: 0 8px;
  border-bottom: 0px solid var(--dir-item-card-border-3);
  border-color: var(--dir-item-card-border-3);
  border-width: 0 0 thin 0;
}

.workspace-area__content {
  overflow: hidden;
  flex: 1 1 auto;
  /* height: 100%;  */
  height: calc(
    100vh -
    var(--window-toolbar-height) -
    var(--action-toolbar-height) -
    var(--workspace-area-toolbar-height)
  );
}

.info-panel__media-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  outline: none;
}

.info-panel__media-preview__icon {
  color: var(--dir-item-card-icon-color) !important;
}

.virtual-list {
  width: 100%;
  height: 100%;
  border: 2px solid;
  border-radius: 3px;
  /* overflow-y: auto; */
  border-color: dimgray;
  padding: 8px 24px;
}

#navigator-route
  .content-area {
    overflow: hidden;
    height: calc(100vh - var(--window-toolbar-height) - var(--action-toolbar-height));
    padding: 0px;
  }

#navigator-route
  .content-area
    .workspace-area__content {
      margin: 0px;
    }
</style>
