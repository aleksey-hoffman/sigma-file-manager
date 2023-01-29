<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <overlay-scrollbars
    :options="{
      className: 'os-theme-minimal-light',
      scrollbars: {
        autoHide: 'move'
      }
    }"
    class="unselectable sortable-list__container"
  >
    <!-- no-data -->
    <div
      v-if="items.length === 0"
      class="ma-4"
    >{{noData}}
    </div>

    <!-- list::item:non-draggable -->
    <div
      v-for="(item, index) in items"
      :key="'item-' + index"
      class="sortable-list__item"
    >
      <v-list-item
        v-if="item.isPrimary"
        @click="handleItemClick(item, index)"
        :is-active="activeitem(item)"
        class="pr-4"
      >
        <!-- list::item:drag-handle -->
        <v-list-item-action>
          <v-icon class="column-drag-handle" pinned>
            mdi-pin-outline
          </v-icon>
        </v-list-item-action>

        <!-- list::item:content:{type: workspaces} -->
        <template v-if="source === 'workspaces'">
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-list-item-content v-on="on">
                <v-list-item-title class="truncate-line">
                  {{item.name}}
                </v-list-item-title>
                <v-list-item-subtitle v-if="item.tabs !== undefined">
                  {{`Tabs: ${item.tabs.length}`}}
                </v-list-item-subtitle>
                <v-list-item-subtitle v-if="item.actions !== undefined && !item.isPrimary">
                  {{`Actions: ${item.actions.length}`}}
                </v-list-item-subtitle>
              </v-list-item-content>
            </template>
            <span>
              {{$t('shortcut')}}:
              {{shortcuts.switchWorkspace.shortcut.replace('[1 - 9]', index + 1)}}
            </span>
          </v-tooltip>

          <!-- list::item:actions -->
          <v-list-item-action>
            <v-layout>
              <v-tooltip bottom z-index="15">
                <template v-slot:activator="{ on }">
                  <v-icon
                    v-show="activeitem(item)"
                    v-on="on"
                    color="blue-grey lighten-3"
                    class="mr-1"
                    size="12px"
                  >mdi-circle-outline
                  </v-icon>
                </template>
                <span>{{$t('active')}} {{itemName}}</span>
              </v-tooltip>
            </v-layout>
          </v-list-item-action>
        </template>
      </v-list-item>
    </div>

    <!-- list::item:draggable -->
    <Container
      v-if="items.length !== 0"
      @drop="onDrop"
      drag-class="sortable-list__item--drag-active"
      :animation-duration="250"
      :get-ghost-parent="getGhostParent"
      drag-handle-selector=".column-drag-handle"
      lock-axis="y"
      class="sortable-list"
    >
      <Draggable
        v-for="(item, index) in items"
        :key="'item-' + index"
        class="sortable-list__item"
        border
      >
        <v-list-item
          v-if="!item.isPrimary"
          @click="handleItemClick(item, index)"
          :is-active="activeitem(item)"
          class="pr-4"
        >
          <!-- list::item:drag-handle -->
          <v-list-item-action
            v-if="!(source === 'workspaces' && item.isPrimary)"
          >
            <v-icon class="column-drag-handle" drag>
              mdi-drag-horizontal
            </v-icon>
          </v-list-item-action>

          <!-- list::item:content:{type: tabs} -->
          <template
            v-if="source === 'tabs'"
          >
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-list-item-content v-on="on">
                  <v-list-item-title class="truncate-line">
                    {{item.name}}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    {{$t('drive')}} {{$utils.getPathRoot(item.path)}}
                  </v-list-item-subtitle>
                </v-list-item-content>
              </template>
              <span>
                {{$t('shortcut')}}:
                {{shortcuts.switchTab.shortcut.replace('[1 - 9]', index + 1)}}
              </span>
            </v-tooltip>

            <!-- list::item:actions -->
            <v-list-item-action>
              <v-layout>
                <v-tooltip bottom z-index="15">
                  <template v-slot:activator="{ on }">
                    <v-icon
                      v-show="activeitem(item)"
                      v-on="on"
                      color="blue-grey lighten-3"
                      class="mr-1"
                      size="12px"
                    >mdi-circle-outline
                    </v-icon>
                  </template>
                  <span>{{$t('active')}} {{itemName}}</span>
                </v-tooltip>

                <v-tooltip bottom z-index="15">
                  <template v-slot:activator="{ on }">
                    <v-btn
                      v-on="on"
                      @click.stop="$store.dispatch('CLOSE_TAB', item)"
                      icon
                      class="ma-0 list-item__action-button"
                    >
                      <v-icon
                        class="list-item__action-button__icon"
                        size="20px"
                      >mdi-close
                      </v-icon>
                    </v-btn>
                  </template>
                  <span>{{$t('close')}} {{itemName}}</span>
                </v-tooltip>
              </v-layout>
            </v-list-item-action>
          </template>

          <!-- list::item:content:{type: workspaces} -->
          <template v-if="source === 'workspaces'">
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-list-item-content v-on="on">
                  <v-list-item-title class="truncate-line">
                    {{item.name}}
                  </v-list-item-title>
                  <v-list-item-subtitle v-if="item.tabs !== undefined">
                    {{`Tabs: ${item.tabs.length}`}}
                  </v-list-item-subtitle>
                  <v-list-item-subtitle v-if="item.actions !== undefined && !item.isPrimary">
                    {{`Actions: ${item.actions.length}`}}
                  </v-list-item-subtitle>
                </v-list-item-content>
              </template>
              <span>
                {{$t('shortcut')}}:
                {{shortcuts.switchWorkspace.shortcut.replace('[1 - 9]', index + 1)}}
              </span>
            </v-tooltip>

            <!-- list::item:actions -->
            <v-list-item-action>
              <v-layout>
                <v-tooltip bottom z-index="15">
                  <template v-slot:activator="{ on }">
                    <v-icon
                      v-show="activeitem(item)"
                      v-on="on"
                      color="blue-grey lighten-3"
                      class="mr-1"
                      size="12px"
                    >mdi-circle-outline
                    </v-icon>
                  </template>
                  <span>{{$t('active')}} {{itemName}}</span>
                </v-tooltip>
              </v-layout>
            </v-list-item-action>
          </template>
        </v-list-item>
      </Draggable>
    </Container>

  </overlay-scrollbars>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import {Container, Draggable} from 'vue-smooth-dnd'

export default {
  components: {
    Container,
    Draggable
  },
  props: {
    source: String,
    noData: String,
    itemName: String
  },
  computed: {
    ...mapFields({
      shortcuts: 'storageData.settings.shortcuts'
    }),
    items: {
      get () {
        if (this.source === 'tabs') {
          return this.$store.getters.selectedWorkspace.tabs
        }
        else if (this.source === 'workspaces') {
          return this.$store.state.storageData.workspaces.items
        }
        else {
          return []
        }
      },
      set (value) {
        if (this.source === 'tabs') {
          this.$store.dispatch('SET_TABS', value)
        }
        else if (this.source === 'workspaces') {
          this.$store.dispatch('setWorkspaces', value)
        }
      }
    }
  },
  methods: {
    handleItemClick (item, index) {
      if (this.source === 'tabs') {
        this.$store.dispatch('SWITCH_TAB', index + 1)
      }
      else if (this.source === 'workspaces') {
        this.$store.dispatch('switchWorkspace', item)
      }
    },
    activeitem (item) {
      if (this.source === 'tabs') {
        return item.path === this.$store.state.navigatorView.currentDir.path
      }
      else if (this.source === 'workspaces') {
        return item.isSelected
      }
      else {
        return false
      }
    },
    getGhostParent () {
      return document.querySelector('#app')
    },
    onDrop (dropResult) {
      // Move item to new index within array
      const { removedIndex, addedIndex, payload } = dropResult
      if (!(removedIndex === null && addedIndex === null)) {
        const list = [...this.items]
        const itemToAdd = list.splice(removedIndex, 1)[0]
        list.splice(addedIndex, 0, itemToAdd)
        this.items = list
      }
    }
  }
}
</script>

<style>
.sortable-list__container.custom-scrollbar {
  /* padding-right: var(--scrollbar-width); */
}

.sortable-list__container.custom-scrollbar:hover {
  /* padding-right: 0px; */
}

.sortable-list__container {
  background-color: var(--bg-color-1);
  max-height: calc(100vh - 128px);
  /* height: 128px; */
  max-width: 400px;
}

.sortable-list {
  position: relative;
}

.sortable-list .__content * {
  width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sortable-list__item {
  position: relative;
  display: flex;
  align-content: center;
  width: 100%;
  background-color: var(--bg-color-1);
  cursor: pointer;
  /* padding: 12px; */
}

.sortable-list__item * {
  color: var(--color-1);
}

.sortable-list__item[border],
.sortable-list__item[border]:before {
  border-bottom: 1px solid var(--divider-color-1);
}

.sortable-list__item.dragging {
}

.sortable-list__item:hover {
  /* background: #f5f5f5; */
}

.sortable-list__item:active {
  /* transform: scale(1.15); */
  /* box-shadow: 0 2px 24px 0 rgb(0,0,0,0.4); */
  z-index: 1;
}

.sortable-list__item--drag-active {
  background-color: var(--context-menu-bg-color_hover);
  box-shadow: 0 2px 24px 0 rgb(0,0,0,0.4);
  z-index: 1;
  transition: box-shadow 0.5s;
}

.column-drag-handle {
  padding: 5px;
}

.column-drag-handle[drag] {
  cursor: move;
}

.smooth-dnd-ghost .v-list-item .__content {
  /* color: red; */
  width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
