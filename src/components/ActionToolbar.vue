<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-app-bar
    v-show="showActionToolbar"
    id="action-toolbar"
    class="action-toolbar fade-in-500ms"
    app
    flat
    clipped-right
    height="42px"
  >
    <home-banner-menu />
    <!-- button::new-note -->
    <v-tooltip bottom>
      <template #activator="{ on }">
        <v-btn
          v-show="['notes'].includes($route.name)"
          class="action-toolbar__item"
          icon
          v-on="on"
          @click="$store.dispatch('OPEN_NOTE_EDITOR', { type: 'new' })"
        >
          <v-icon
            class="action-toolbar__icon"
            size="22px"
          >
            mdi-plus
          </v-icon>
        </v-btn>
      </template>
      <span>New note</span>
    </v-tooltip>

    <!-- toggle-button -->
    <v-btn-toggle
      v-show="['notes'].includes($route.name)"
      v-model="currentNotesList"
      class="dir-item-layout-toggle"
      dense
      mandatory
    >
      <!-- toggle-button::existing-notes -->
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            value="existing"
            class="action-toolbar__item action-toolbar__toggle-button"
            active-class="toggle--active"
            icon
            small
            v-on="on"
            @click="$store.dispatch('SET', {key: 'currentNotesList', value: 'existing'})"
          >
            <v-icon
              class="action-toolbar__icon"
              size="20px"
            >
              mdi-square-edit-outline
            </v-icon>
          </v-btn>
        </template>
        <span>Existing notes</span>
      </v-tooltip>

      <!-- toggle-button::trashed-notes -->
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            value="trashed"
            class="action-toolbar__item action-toolbar__toggle-button"
            active-class="toggle--active"
            icon
            small
            v-on="on"
            @click="$store.dispatch('SET', {key: 'currentNotesList', value: 'trashed'})"
          >
            <v-icon
              class="action-toolbar__icon"
              size="20px"
            >
              mdi-trash-can-outline
            </v-icon>
          </v-btn>
        </template>
        <span>Trashed notes</span>
      </v-tooltip>
    </v-btn-toggle>

    <!-- button::new-dir-item -->
    <v-menu offset-y>
      <template #activator="{ on: menu }">
        <v-tooltip bottom>
          <template #activator="{ on: tooltip }">
            <v-btn
              v-show="['navigator'].includes($route.name)"
              class="action-toolbar__item"
              icon
              v-on="{ ...tooltip, ...menu }"
            >
              <v-icon
                class="action-toolbar__icon"
                size="22px"
              >
                mdi-plus
              </v-icon>
            </v-btn>
          </template>
          <span>New directory / file</span>
        </v-tooltip>
      </template>
      <v-list>
        <v-list-item
          v-for="(item, index) in newDirItemMenu"
          :key="index"
          two-line
          dense
          @click="$store.dispatch('INIT_NEW_DIR_ITEM', item)"
        >
          <div class="mr-4">
            <v-icon>{{item.icon}}</v-icon>
          </div>
          <v-list-item-content>
            <v-list-item-title>{{item.title}}</v-list-item-title>
            <v-list-item-subtitle>{{shortcuts[item.shortcut].shortcut}}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- button::sorting-menu -->
    <sorting-menu
      v-if="['navigator'].includes($route.name) && navigatorSortingElementDisplayType === 'icon'"
    >
      <template #activator="{menuActivatorOnProp}">
        <v-btn
          class="action-toolbar__item"
          icon
          v-on="menuActivatorOnProp"
        >
          <v-icon size="18px">
            mdi-sort
          </v-icon>
        </v-btn>
      </template>
    </sorting-menu>

    <!-- TODO: finish in v1.1.0
      - Curently dir item range selection doesn't work properly
        because grouping changes dr item indexes
    -->
    <!-- button::group -->
    <!-- <v-tooltip bottom>
      <template v-slot:activator="{ on }">
        <v-btn
          v-show="['navigator'].includes($route.name)"
          v-on="on"
          @click="groupDirItems = !groupDirItems"
          icon
          class="action-toolbar__item"
        >
          <v-icon
            :class="{
              'action-toolbar__icon': !groupDirItems,
              'action-toolbar__icon--active': groupDirItems
            }"
            size="20px"
          >mdi-view-agenda-outline
          </v-icon>
        </v-btn>
      </template>
      <span>Group files by type | {{groupDirItems ? 'ON' : 'OFF'}} </span>
    </v-tooltip> -->

    <!-- toggle-button::navigator-layout -->
    <v-btn-toggle
      v-show="['navigator'].includes($route.name)"
      v-model="navigatorLayout"
      class="dir-item-layout-toggle"
      dense
      mandatory
    >
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            value="list"
            class="action-toolbar__item action-toolbar__toggle-button"
            active-class="toggle--active"
            icon
            small
            v-on="on"
          >
            <v-icon
              class="action-toolbar__icon"
              size="20px"
            >
              mdi-view-list
            </v-icon>
          </v-btn>
        </template>
        <span>List layout</span>
      </v-tooltip>
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            value="grid"
            class="action-toolbar__item action-toolbar__toggle-button"
            active-class="toggle--active"
            icon
            small
            v-on="on"
          >
            <v-icon
              class="action-toolbar__icon"
              size="20px"
            >
              mdi-view-module
            </v-icon>
          </v-btn>
        </template>
        <span>Grid layout</span>
      </v-tooltip>
    </v-btn-toggle>

    <!-- menu::app-quick-actions -->
    <v-menu offset-y>
      <template #activator="{ on: menu, attrs }">
        <v-tooltip
          bottom
          :disabled="attrs['aria-expanded'] === 'true'"
        >
          <template #activator="{ on: tooltip }">
            <v-btn
              v-show="['settings'].includes($route.name)"
              class="action-toolbar__item"
              icon
              v-on="{ ...tooltip, ...menu }"
            >
              <v-icon
                class="action-toolbar__icon"
                size="32px"
              >
                mdi-menu-down
              </v-icon>
            </v-btn>
          </template>
          <span>App quick actions</span>
        </v-tooltip>
      </template>
      <v-list dense>
        <v-list-item
          v-for="(item, index) in quickActions"
          :key="index"
          @click="item.action"
        >
          <div class="mr-4">
            <v-icon>{{item.icon}}</v-icon>
          </div>
          <v-list-item-title>{{item.title}}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- menu::app-related-links -->
    <v-menu offset-y>
      <template #activator="{ on: menu, attrs}">
        <v-tooltip
          bottom
          :disabled="attrs['aria-expanded'] === 'true'"
        >
          <template #activator="{ on: tooltip }">
            <v-btn
              v-show="['settings'].includes($route.name)"
              class="action-toolbar__item"
              icon
              v-on="{ ...tooltip, ...menu }"
            >
              <v-icon
                class="action-toolbar__icon"
                size="20px"
              >
                mdi-link-variant
              </v-icon>
            </v-btn>
          </template>
          <span>App related links</span>
        </v-tooltip>
      </template>
      <v-list dense>
        <v-list-item
          v-for="(item, index) in appExternalLinks"
          :key="index"
          @click="item.action"
        >
          <div class="mr-4">
            <v-icon>{{item.icon}}</v-icon>
          </div>
          <v-list-item-title>{{item.title}}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- menu::app-directories -->
    <v-menu offset-y>
      <template #activator="{ on: menu, attrs }">
        <v-tooltip
          bottom
          :disabled="attrs['aria-expanded'] === 'true'"
        >
          <template #activator="{ on: tooltip }">
            <v-btn
              v-show="['settings'].includes($route.name)"
              class="action-toolbar__item"
              icon
              v-on="{ ...tooltip, ...menu }"
            >
              <v-icon
                class="action-toolbar__icon"
                size="20px"
              >
                mdi-folder-outline
              </v-icon>
            </v-btn>
          </template>
          <span>App directories</span>
        </v-tooltip>
      </template>
      <v-list dense>
        <v-list-item
          v-for="(item, index) in appDirectories"
          :key="index"
          @click="$store.dispatch('LOAD_DIR', { path: item.link })"
        >
          <div class="mr-4">
            <v-icon>{{item.icon}}</v-icon>
          </div>
          <v-list-item-title>{{item.title}}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <v-divider
      v-show="['navigator'].includes($route.name)"
      class="action-toolbar__divider mx-2"
      vertical
    />
    <v-spacer />
    <v-divider
      v-show="['navigator'].includes($route.name)"
      class="action-toolbar__divider mx-2"
      vertical
    />

    <!-- button:info-panel -->
    <v-tooltip bottom>
      <template #activator="{ on }">
        <v-btn
          v-show="['navigator'].includes($route.name)"
          class="action-toolbar__item"
          icon
          v-on="on"
          @click="toggleInfoPanel()"
        >
          <v-icon
            class="action-toolbar__icon"
            size="18px"
          >
            mdi-dock-right
          </v-icon>
        </v-btn>
      </template>
      <span>Toggle info panel</span>
    </v-tooltip>

    <filter-field v-show="['settings'].includes($route.name)" />
  </v-app-bar>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  data () {
    return {
      newDirItemMenu: [
        {
          title: 'New directory',
          icon: 'mdi-folder-plus-outline',
          type: 'directory',
          shortcut: 'newDirectory',
        },
        {
          title: 'New file',
          icon: 'mdi-file-plus-outline',
          type: 'file',
          shortcut: 'newFile',
        },
      ],
      deletedNotesView: 'notes',
    }
  },
  computed: {
    ...mapFields({
      appPaths: 'storageData.settings.appPaths',
      shortcuts: 'storageData.settings.shortcuts',
      groupDirItems: 'storageData.settings.groupDirItems',
      currentNotesList: 'currentNotesList',
      sortingOrder: 'sorting.order',
      selectedSortingType: 'sorting.selectedType',
      sortingTypes: 'sorting.types',
      homeBannerValue: 'storageData.settings.homeBanner.value',
      currentDir: 'navigatorView.currentDir',
      navigatorViewInfoPanel: 'storageData.settings.infoPanels.navigatorView',
      navigatorSortingElementDisplayType: 'storageData.settings.navigator.sorting.elementDisplayType',
    }),
    navigatorLayout: {
      get () {
        return this.$store.state.storageData.settings.navigatorLayout
      },
      set (value) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.navigatorLayout',
          value,
        })
        // Reload dir to update item 'height' property
        this.$store.dispatch('LOAD_DIR', {
          path: this.currentDir.path,
          scrollTop: false,
        })
      },
    },
    quickActions () {
      return [
        {
          title: 'Reset settings',
          icon: 'mdi-restore-alert',
          action: () => {
            this.$store.dispatch('RESET_APP_SETTINGS')
          },
        },
      ]
    },
    appExternalLinks () {
      return [
        {
          title: 'Project page on Github',
          icon: 'mdi-github',
          action: () => {
            this.$utils.openLink(
              `https://github.com/${this.appPaths.githubRepo}`,
            )
          },
        },
        {
          title: 'Request feature',
          icon: 'mdi-github',
          action: () => {
            this.$utils.openLink(
              this.appPaths.githubIssueTemplateFeatureRequest,
            )
          },
        },
        {
          title: 'Report problem',
          icon: 'mdi-github',
          action: () => {
            this.$utils.openLink(
              this.appPaths.githubIssueTemplateProblemReport,
            )
          },
        },
      ]
    },
    appDirectories () {
      return [
        {
          title: 'App directory',
          icon: 'mdi-folder-outline',
          link: this.appPaths.storageDirectories.appStorage,
          linkType: 'local',
        },
        {
          title: 'App media directory',
          icon: 'mdi-folder-outline',
          link: this.appPaths.storageDirectories.appStorageMedia,
          linkType: 'local',
        },
      ]
    },
    showActionToolbar () {
      return this.$route.name !== 'home' ||
        (this.$route.name === 'home' && this.homeBannerValue === false)
    },
  },
  methods: {
    toggleInfoPanel () {
      if (this.$route.name === 'navigator') {
        let appLayoutElement = document.querySelector('#app')
        appLayoutElement.setAttribute('preserve-transition', true)
        setTimeout(() => {
          appLayoutElement.removeAttribute('preserve-transition')
        }, 500)
        this.navigatorViewInfoPanel.value = !this.navigatorViewInfoPanel.value
      }
    },
  },
}
</script>

<style>
#action-toolbar {
  padding: 0px;
  margin-top: var(--window-toolbar-height) !important;
  background-color: var(--bg-color-1);
  /* border-top: 1px solid var(--divider-color-1);
  border-bottom: 1px solid var(--divider-color-1); */
  outline: 1px solid var(--divider-color-1)
}

#action-toolbar
  .v-toolbar__content {
    display: flex;
    align-items: center;
    gap: var(--toolbar-item-gap);
    padding:
      0px
      var(--window-toolbar-padding-right)
      0px
      var(--window-toolbar-padding-left) !important;
  }

.action-toolbar__icon {
  color: var(--icon-color-2) !important;
}

.action-toolbar__icon--active {
  color: var(--icon-color-1) !important;
}

.action-toolbar__divider.v-divider--vertical {
  min-height: 75% !important;
  max-height: 75% !important;
  margin-top: auto;
  margin-bottom: auto;
  border-color: var(--divider-color-2) !important
}

.v-btn-toggle.dir-item-layout-toggle {
  background: transparent !important;
}

.action-toolbar__toggle-button {
  margin: 0px !important;
  opacity: 1 !important;
}

.action-toolbar__toggle-button.toggle--active {
  margin: 0px !important;
  opacity: 1 !important;
}

#app
  .action-toolbar__toggle-button.toggle--active
    .v-btn__content {
      position: relative;
    }

#app
  .action-toolbar__toggle-button.toggle--active
    .v-btn__content::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 100%;
      height: 1px;
      box-shadow: 0 0 6px #0e6f9688;
      background-color: var(--nav-panel-indicator-color);
    }

#app
  .action-toolbar__toggle-button
    * {
      border-radius: 0 !important;
    }

.action-toolbar__toggle-button
  .v-icon {
    color: var(--color-7) !important;
  }

.action-toolbar__toggle-button.toggle--active
  .v-icon {
    color: var(--icon-color-1) !important;
  }

.v-btn:not(.v-btn--text):not(.v-btn--outlined).v-btn--active:before {
  opacity: 0 !important;
}

.v-btn--active:before,
.v-btn--active:hover:before,
.v-btn:focus:before {
  opacity: 0 !important;
}
</style>
