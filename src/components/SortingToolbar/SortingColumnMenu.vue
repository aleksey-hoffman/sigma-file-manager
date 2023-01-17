<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-menu
    :close-on-content-click="false"
    offset-y
  >
    <template #activator="{on}">
      <slot
        name="activator"
        :menuActivatorOnProp="on"
      />
    </template>
    <v-list dense>
      <v-list-item class="inactive">
        <v-list-item-content>
          <v-list-item-title>
            <div class="text--sub-title-1 ma-0">
              {{$t('sorting.columnType')}}
            </div>
          </v-list-item-title>
        </v-list-item-content>
      </v-list-item>

      <v-list-item
        v-for="(menuSortingType, index) in sortingTypes"
        :key="index"
        @click="setColumnSortingType(sortingType, menuSortingType)"
      >
        <v-list-item-title>
          {{$t(menuSortingType.title)}}
        </v-list-item-title>

        <v-list-item-icon>
          <v-icon
            v-if="sortingType.name === menuSortingType.name"
            class="mr-4"
            size="10px"
          >
            mdi-circle-outline
          </v-icon>
        </v-list-item-icon>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  props: {
    sortingType: Object,
  },
  data () {
    return {
      clickedColumnItemIndex: null,
    }
  },
  computed: {
    ...mapFields({
      sortingOrder: 'storageData.settings.sorting.order',
      selectedSortingType: 'storageData.settings.sorting.selectedType',
      sortingTypes: 'storageData.settings.sorting.types',
    }),
  },
  methods: {
    setColumnSortingType (sortingType, menuSortingType) {
      this.clickedColumnItemIndex = this.sortingTypes.findIndex(listSortingType => listSortingType.name === sortingType.name)
      let replaceItemIndex = this.sortingTypes.findIndex(listSortingType => listSortingType.name === menuSortingType.name)
      let clickedColumnItem = {...this.sortingTypes[this.clickedColumnItemIndex]}
      let replaceItem = {...this.sortingTypes[replaceItemIndex]}
      let tempIsChecked = clickedColumnItem.isChecked
      clickedColumnItem.isChecked = replaceItem.isChecked
      replaceItem.isChecked = tempIsChecked
      this.sortingTypes.splice(this.clickedColumnItemIndex, 1, replaceItem)
      this.sortingTypes.splice(replaceItemIndex, 1, clickedColumnItem)
      this.clickedColumnItemIndex = replaceItemIndex
      this.$store.dispatch('SET_SORTING_TYPE', menuSortingType)
    },
  },
}
</script>
