<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <div class="filter-field">
      <input
        ref="filterField"
        v-model="filterQuery"
        @focus="$store.dispatch('SET', {
          key: 'focusedField',
          value: 'filter'
        })"
        @blur="$store.dispatch('SET', {
          key: 'focusedField',
          value: ''
        })"
        @keydown.esc.stop="clearQuery()"
        placeholder="Filter"
        type="text"
        maxlength="64"
      >

      <div
        class="filter-field__buttons"
        :class="{'visible': filterQuery.length > 0}"
      >
        <div class="filter-field__clear-button">
          <v-btn
            @click="clearQuery()"
            small
            icon
          >
            <v-icon size="18px">
              mdi-backspace-outline
            </v-icon>
          </v-btn>
        </div>

        <div class="filter-field__menu-button">
          <v-menu
            offset-y
            min-width="300px"
            :close-on-content-click="false"
          >
            <template v-slot:activator="{ on: menu }">
              <v-tooltip bottom>
                <template v-slot:activator="{ on: tooltip }">
                  <v-btn
                    v-on="{ ...tooltip, ...menu }"
                    icon
                  >
                    <v-icon>
                      mdi-filter-variant
                    </v-icon>
                  </v-btn>
                </template>
                <span>Filter options</span>
              </v-tooltip>
            </template>
            <v-card class="unselectable">
              <v-list class="inactive">
                <v-list-item class="inactive">
                  <v-list-item-content class="text--sub-title-1 ma-0">
                    <v-list-item-title>
                      Filter options
                    </v-list-item-title>
                  </v-list-item-content>
                </v-list-item>

                <v-divider></v-divider>

                <v-list-item class="px-5" dense>
                  <v-switch
                    v-model="filterQueryOptionGlob"
                    label="Glob filtering"
                  ></v-switch>
                </v-list-item>

                <v-list-item
                  class="px-5"
                  v-if="$route.name !== 'notes'"
                  dense
                >
                  <v-switch
                    v-model="navigatorShowHiddenDirItems"
                    label="Show Hidden Items"
                  ></v-switch>
                </v-list-item>

                <v-divider></v-divider>

                <v-list-item class="inactive">
                  <v-list-item-content class="text--sub-title-1 ma-0">
                    <v-list-item-title>
                      Filter prefixes
                    </v-list-item-title>
                  </v-list-item-content>
                </v-list-item>

                <v-list-item
                  v-for="(item, index) in filterProperties"
                  :key="'item-' + index"
                  dense
                >
                  <v-list-item-content>
                    <v-list-item-title>
                      {{item.prefix}} [{{item.title}}]
                    </v-list-item-title>
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </v-card>
          </v-menu>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapFields } from 'vuex-map-fields'

export default {
  mounted () {
    this.$eventHub.$on('focusFilter', () => {
      if (document.querySelector('.filter-field') === document.activeElement) {
        this.$refs.filterField.blur()
      }
      else {
        this.$refs.filterField.focus()
      }
    })
  },
  beforeDestroy () {
    this.$eventHub.$off('focusFilter')
  },
  computed: {
    ...mapFields({
      notesItems: 'storageData.notes.items',
      dirItems: 'navigatorView.dirItems',
      focusedField: 'focusedField',
      navigatorShowHiddenDirItems: 'storageData.settings.navigator.showHiddenDirItems'
    }),
    filterQuery: {
      get () {
        return this.$store.state.filterField.view[this.$route.name].query
      },
      set (value) {
        this.$store.dispatch('SET', {
          key: `filterField.view.${this.$route.name}.query`,
          value: value
        })
      }
    },
    filterQueryMatchedItems: {
      get () {
        return this.$store.state.filterField.view[this.$route.name].matchedItems
      },
      set (value) {
        this.$store.dispatch('SET', {
          key: `filterField.view.${this.$route.name}.matchedItems`,
          value: value
        })
      }
    },
    filterQueryOptions: {
      get () {
        return this.$store.state.filterField.view[this.$route.name].options
      },
      set (value) {
        this.$store.dispatch('SET', {
          key: `filterField.view.${this.$route.name}.options`,
          value: value
        })
      }
    },
    filterQueryOptionGlob: {
      get () {
        return this.$store.state.filterField.view[this.$route.name].options.glob
      },
      set (value) {
        this.$store.dispatch('SET', {
          key: `filterField.view.${this.$route.name}.options.glob`,
          value: value
        })
      }
    },
    filterProperties () {
      return this.$store.state.filterField.view[this.$route.name].filterProperties
    },
    getItems () {
      let items = []
      if (this.$route.name === 'notes') {
        items = this.notesItems
      }
      if (this.$route.name === 'navigator') {
        items = this.dirItems
      }
      return items
    }
  },
  methods: {
    clearQuery () {
      this.filterQuery = ''
      this.$refs.filterField.blur()
    }
  }
}
</script>

<style>
.filter-field {
  position: relative;
  display: flex;
  align-items: center;
  width: 200px;
  background-color: rgb(255, 255, 255, 0.025);
}

.filter-field
  input {
    width: 100%;
    height: 32px;
    margin-left: 0px;
    padding-top: 0px;
    padding-left: 12px;
    background: transparent;
    color: var(--color-6);
    border: 0px solid #b0bec5;
    caret-color: var(--color-6);
    outline: none;
  }

.filter-field
  input:focus {
    padding-top: 1px;
    border-width: 0 0 thin 0;
    border-color: var(--color-6);
  }

.filter-field
  input::placeholder {
    color: var(--color-7);
  }

.filter-field
  input:focus::placeholder {
    opacity: 0.5;
  }

.filter-field__buttons {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 4px;
  right: 0px;
}

.filter-field__clear-button {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}

.filter-field__buttons.visible
  .filter-field__clear-button {
    opacity: 1;
    pointer-events: initial;
    transition: opacity 0.3s;
  }
</style>
