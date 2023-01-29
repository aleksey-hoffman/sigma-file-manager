<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-menu
    v-model="showClipboardMenu"
    :close-on-content-click="false"
    top
    offset-y
  >
    <template #activator="{ on: menu, attrs }">
      <v-tooltip
        top
        :disabled="$vuetify.breakpoint.mdAndUp"
      >
        <template #activator="{ on: tooltip }">
          <v-btn
            class="clipboard-toolbar__button"
            :text="$vuetify.breakpoint.mdAndUp"
            :icon="$vuetify.breakpoint.smAndDown"
            small
            v-bind="attrs"
            v-on="{ ...tooltip, ...menu }"
          >
            <v-icon size="14">
              mdi-format-list-bulleted
            </v-icon>
            <div
              v-show="$vuetify.breakpoint.mdAndUp"
              class="ml-2"
            >
              {{$t('showItems')}}
            </div>
          </v-btn>
        </template>
        <span>{{$t('showItems')}}</span>
      </v-tooltip>
    </template>
    <v-list
      class="custom-scrollbar"
      width="300"
      height="280"
      dense
    >
      <v-list-item>
        <v-text-field
          v-model="clipboardMenuFilterQuery"
          class="pt-0 mb-2"
          :label="$t('filter.filter')"
          single-line
          hide-details
        />
      </v-list-item>
      <v-list-item
        v-if="items.length > maxVisibleItemCount"
        :class="$t('clipboard.inactiveUnselectable')"
      >
        <v-list-item-content>
          <v-list-item-title>
            {{title}}
          </v-list-item-title>
          <v-list-item-subtitle v-if="clipboardMenuFilterQuery">
            {{subtitle}}
          </v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
      <v-list-item
        v-else-if="items.length <= maxVisibleItemCount && clipboardMenuFilterQuery"
        :class="$t('clipboard.inactiveUnselectable')"
      >
        <v-list-item-content>
          <v-list-item-subtitle>
            {{subtitle}}
          </v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
      <v-list-item
        v-for="(item, index) in itemsFilteredSliced"
        :key="index"
      >
        <v-list-item-content>
          <v-list-item-title>{{item.name}}</v-list-item-title>
          <v-list-item-subtitle>{{item.path}}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-avatar>
          <v-btn
            small
            icon
            @click="removeDirItemFromList(item)"
          >
            <v-icon size="18px">
              mdi-close
            </v-icon>
          </v-btn>
        </v-list-item-avatar>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import itemFilter from '@/utils/itemFilter'

export default {
  props: {
    type: {
      type: String,
      default: 'clipboard',
    },
  },
  data () {
    return {
      maxVisibleItemCount: 100,
      showClipboardMenu: false,
      clipboardMenuFilterQuery: '',
    }
  },
  watch: {
    'fsClipboard.items' () {
      if (this.type === 'selected') {return}
      if (this.fsClipboard.items.length === 0) {
        this.showClipboardMenu = false
      }
    },
    selectedDirItems () {
      if (this.type === 'clipboard') {return}
      if (this.selectedDirItems.length === 0) {
        this.showClipboardMenu = false
      }
    },
    showClipboardMenu () {
      this.clipboardMenuFilterQuery = ''
    },
  },
  computed: {
    ...mapFields({
      fsClipboard: 'navigatorView.clipboard.fs',
      selectedDirItems: 'navigatorView.selectedDirItems',
    }),
    items () {
      if (this.type === 'selected') {
        return this.selectedDirItems
      }
      else {
        return this.fsClipboard.items
      }
    },
    itemsFiltered () {
      return this.getItemsMatchingFilter(this.items)
    },
    itemsFilteredSliced () {
      return this.itemsFiltered.slice(0, this.maxVisibleItemCount)
    },
    title () {
      const displayedItemCount = Math.min(this.itemsFiltered.length, this.maxVisibleItemCount)
      return this.$t('clipboard.showingNOfItems', {showingAmount: displayedItemCount, itemsAmount: this.items.length})
    },
    subtitle () {
      return this.$t('clipboard.matchedNOfItems', {matchedAmount: this.itemsFiltered.length, itemsAmount: this.items.length})
    },
  },
  methods: {
    getItemsMatchingFilter (items) {
      return itemFilter({
        filterQuery: this.clipboardMenuFilterQuery,
        items,
        filterHiddenItems: false,
        filterProperties: this.$store.state.filterField.view.navigator.filterProperties,
        filterQueryOptions: this.$store.state.filterField.view.navigator.options,
      })
    },
    removeDirItemFromList (item) {
      let itemIndex = this.items.findIndex(listItem => listItem.path === item.path)
      this.items.splice(itemIndex, 1)
    },
  },
}
</script>

<style>
.v-menu__content
  .v-avatar.v-list-item__avatar {
    margin-right: -8px;
  }
</style>