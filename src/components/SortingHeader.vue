<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <!-- navigator-layout:grid -->
    <div
      class="sorting-header"
      v-if="navigatorLayout === 'grid'"
      :navigator-layout="navigatorLayout"
      :style="{
        'grid-template-columns': '48px minmax(10px, max-content)'
      }"
    >
      <sorting-menu>
        <template v-slot:activator="{menuActivatorOnProp}">
          <div 
            class="sorting-header__item"  
            v-on="menuActivatorOnProp" 
            is-sort-icon
          >
            <v-icon size="18px">mdi-sort</v-icon>
          </div>
        </template>
      </sorting-menu>

      <div
        class="sorting-header__item"
        @click="selectedSortingHeaderType.onClick(selectedSortingHeaderType)"
        :is-selected="selectedSortingType.name === selectedSortingHeaderType.name"
        :sorting-order="sortingOrder"
      >
        <sorting-column-menu
        :sortingType="selectedSortingHeaderType"
        >
          <template v-slot:activator="{menuActivatorOnProp}">
            <div 
              class="sorting-header__item__inner"
              @contextmenu.prevent="menuActivatorOnProp.click"
            >
              <div class="sorting-header__item__title">
                {{selectedSortingHeaderType.shortTitle}}
              </div>
            </div>
          </template>
        </sorting-column-menu>
      </div>
    </div>

    <!-- navigator-layout:list -->
    <div 
      class="sorting-header" 
      v-if="navigatorLayout === 'list'"
      :navigator-layout="navigatorLayout"
      :style="{
        'grid-template-columns': sortingHeaderGridColumnTemplate.join(' ')
      }"
    >
      <sorting-menu>
        <template v-slot:activator="{menuActivatorOnProp}">
          <div 
            class="sorting-header__item"  
            v-on="menuActivatorOnProp" 
            is-sort-icon
          >
            <v-icon size="18px">mdi-sort</v-icon>
          </div>
        </template>
      </sorting-menu>

      <div
        class="sorting-header__item"
        v-for="(sortingType, index) in sortingTypes"
        :key="'item-' + index"
        @click="sortingType.onClick(sortingType)"
        :is-selected="selectedSortingType.name === sortingType.name"
        :sorting-order="sortingOrder"
        :style="{
          'display': sortingType.isChecked ? 'inline-flex' : 'none'
        }"
      > 
        <sorting-column-menu
          :sortingType="sortingType"
        >
          <template v-slot:activator="{menuActivatorOnProp}">
            <div 
              class="sorting-header__item__inner"
              @contextmenu.prevent="menuActivatorOnProp.click"
            >
              <div class="sorting-header__item__title">
                {{sortingType.shortTitle}}
              </div>
            </div>
          </template>
        </sorting-column-menu>
      </div>
    </div>
  </div>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'

export default {
  computed: {
    ...mapFields({
      sortingOrder: 'sorting.order',
      selectedSortingType: 'sorting.selectedType',
      sortingTypes: 'sorting.types',
      navigatorLayout: 'storageData.settings.navigatorLayout',
    }),
    ...mapGetters([
      'sortingHeaderGridColumnTemplate'
    ]),
    selectedSortingHeaderType () {
      return this.sortingTypes.find(item => this.selectedSortingType.name === item.name)
    },
  }
}
</script>

<style>
.sorting-header {
  display: grid;
  border-bottom: 1px solid var(--dir-item-card-border-3);
  align-items: center;
  height: var(--workspace-area-sorting-header-height);
  padding: 0 24px;
  color: var(--color-7);
  font-size: 12px;
  text-transform: uppercase;
}

.sorting-header__item {
  display: flex;
  align-items: center;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0);
  height: 28px;
}

.sorting-header__item__inner {
  display: flex;
  align-items: center;
  width: 100%;
}

.sorting-header__item:not(:nth-child(1)):not(:nth-child(2)) 
  .sorting-header__item__inner {
    justify-content: center;
  }

.sorting-header__item[is-sort-icon] {
  justify-content: center;
}

.sorting-header__item:hover {
  background-color: var(--bg-color-1);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.sorting-header__item__title {
  position: relative;
  display: flex;
  align-items: center;
  width: fit-content;
  padding: 
    var(--workspace-area-sorting-header-item-v-padding) 
    var(--workspace-area-sorting-header-item-h-padding);
  padding-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sorting-header__item:nth-child(2)
  .sorting-header__item__title {
    padding: 
      var(--workspace-area-sorting-header-item-v-padding) 
      var(--workspace-area-sorting-header-item-2-h-padding);
    padding-top: 4px;
  }

.sorting-header__item[is-selected][sorting-order='ascending']
  .sorting-header__item__title::after,
.sorting-header__item[is-selected][sorting-order='descending']
  .sorting-header__item__title::after {
    content: "";
    position: absolute;
    width: 16px;
    top: 0px;
    left: calc(50% - 8px);
    height: 1px;
    background-color: var(--nav-panel-indicator-color);
    box-shadow: 0 0px 6px #0e6f96;
  }

.sorting-header__item[is-selected][sorting-order='descending']
  .sorting-header__item__title::after {
    top: unset;
    bottom: 0px;
  }

.sorting-header 
  .v-icon {
    color: var(--highlight-color-1) !important;
  }
</style>