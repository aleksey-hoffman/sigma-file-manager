<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div id="navigator-route">
    <context-menus/>
    <info-panel/>
    <!-- content-area -->
    <div
      :clipboard-toolbar-visible="clipboardToolbarIsVisible"
      class="content-area"
      id="content-area"
    >
      <!-- workspace-area -->
      <div class="workspace__area__container" columns_1>
        <div class="workspace__area">
          <!-- workspace-area::toolbar -->
          <v-layout align-center class="workspace-area__header">
            <!-- button::current-directory-context-menu -->
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  @click="toggleCurrentDirContextMenu($event)"
                  icon
                  class="action-toolbar__item"
                >
                  <v-icon class="action-toolbar__icon" size="32px">
                    mdi-menu-down
                  </v-icon>
                </v-btn>
              </template>
              <span>Current directory context menu</span>
            </v-tooltip>

            <!-- button::go-backward-in-history -->
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  @click="$store.dispatch('LOAD_PREVIOUS_HISTORY_PATH')"
                  icon
                  class="action-toolbar__item"
                >
                  <v-icon class="action-toolbar__icon" size="20px">
                    mdi-arrow-left
                  </v-icon>
                </v-btn>
              </template>
              <span>History | open previous directory</span>
            </v-tooltip>

            <!-- button::go-forward-in-history -->
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  @click="$store.dispatch('LOAD_NEXT_HISTORY_PATH')"
                  icon
                  class="action-toolbar__item"
                >
                  <v-icon class="action-toolbar__icon" size="20px">
                    mdi-arrow-right
                  </v-icon>
                </v-btn>
              </template>
              <span>History | open next directory</span>
            </v-tooltip>

            <!-- button::go-up-directory -->
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  @click="$store.dispatch('GO_UP_DIRECTORY')"
                  icon
                  class="action-toolbar__item"
                >
                  <v-icon class="action-toolbar__icon" size="20px">
                    mdi-arrow-up
                  </v-icon>
                </v-btn>
              </template>
              <span>Go up directory</span>
            </v-tooltip>

            <!-- button::reload -->
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  @click="$store.dispatch('LOAD_DIR', {
                    path: currentDir.path,
                    scrollTop: false
                  })"
                  icon
                  class="action-toolbar__item"
                >
                  <v-icon class="action-toolbar__icon" size="20px">
                    mdi-refresh
                  </v-icon>
                </v-btn>
              </template>
              <span>Reload current directory</span>
            </v-tooltip>

            <address-bar/>
            <v-spacer/>
            <filter-field/>
          </v-layout>

          <global-search v-show="globalSearchWidget"/>
          <div v-if="filterQuery.length > 0" class="content__description">
            <v-btn
              @click="filterQuery = ''"
              small
              class="mt-5 mx-6 button-1"
            >
              <v-icon
                size="16px"
                class="mr-2"
              >mdi-backspace-outline
              </v-icon>
              Clear filter
            </v-btn>
          </div>
          <workspace-area-content/>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapFields } from 'vuex-map-fields'
import { mapGetters } from 'vuex'

export default {
  name: 'navigator',
  data () {
    return {
      processedDirItemsIndexes: [],
      dirItemAwaitsSecondClick: false,
      dirItemAwaitsSecondClickTimeout: null,
      dirItemSecondClickDelay: 500
    }
  },
  beforeRouteLeave (to, from, next) {
    this.$eventHub.$emit('app:method', {
      method: 'setRouteScrollPosition',
      params: {
        toRoute: to,
        fromRoute: from
      }
    })
    next()
  },
  async mounted () {
    this.$nextTick(() => {
      this.$store.dispatch('ROUTE_MOUNTED_HOOK_CALLBACK', {
        route: 'navigator'
      })
      this.navigatorRouteIsLoaded = true
    })
  },
  beforeDestroy () {
    this.navigatorRouteIsLoaded = false
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
      if (this.onlyCurrentDirIsSelected) {
        this.contextMenus.dirItem.value = false
      }
    },
    'navigatorView.selectedDirItems' (value) {
      this.contextMenus.dirItem.value = false
    }
  },
  computed: {
    ...mapGetters([
      'selectedWorkspace',
      'selectedDirItems',
      'clipboardToolbarIsVisible',
      'onlyCurrentDirIsSelected'
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
      protectedItems: 'storageData.protected.items'
    })
  },
  methods: {
    toggleCurrentDirContextMenu (payload) {
      this.$store.dispatch('DESELECT_ALL_DIR_ITEMS')
      this.$store.dispatch('ADD_TO_SELECTED_DIR_ITEMS', this.currentDir)
        .then(() => {
          this.$store.dispatch('SET_CONTEXT_MENU', {
            value: 'toggle',
            x: payload.clientX,
            y: payload.clientY
          })
        })
    }
  }
}
</script>

<style>
.workspace__area__container[columns_2] {
  display: grid;
  grid-template-columns: 1fr 1fr;
  /* gap: 20px; */
}

.workspace__area__container[columns_1] {
  display: grid;
  grid-template-columns: 1fr;
  /* gap: 20px; */
}

.workspace__area:nth-child(2) {
  border-left: 1px solid var(--dir-item-card-border);
}

.workspace__area__name {
}

.workspace__area {
  display: grid;
  grid-template-rows: 48px 1fr;
  /* gap: 20px; */

}

.workspace-area__header {
  /* padding: 8px 24px;
  background-color: rgb(255, 255, 255, 0.02); */

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

.info-panel__preview-container {

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

#navigator-route
  .content-area[clipboard-toolbar-visible] {
    /* height: calc(100vh - var(--window-toolbar-height) - var(--action-toolbar-height) - 32px); */
    /* padding-bottom: 32px; */
    overflow: hidden;
  }

#navigator-route
  .content-area[clipboard-toolbar-visible]
    .workspace-area__content {
      padding-bottom: 132px;
    }

</style>
