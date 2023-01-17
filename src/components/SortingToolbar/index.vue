<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    v-if="navigatorSortingElementDisplayType === 'toolbar'"
    class="sorting-header"
  >
    <!-- navigator-layout:grid -->
    <div
      v-if="navigatorLayout === 'grid'"
      class="sorting-header__inner"
      :navigator-layout="navigatorLayout"
      :style="{
        'grid-template-columns': '48px minmax(10px, max-content)'
      }"
    >
      <SortingMenu>
        <template #activator="{menuActivatorOnProp}">
          <div
            class="sorting-header__item"
            is-sort-icon
            v-on="menuActivatorOnProp"
          >
            <v-icon size="18px">
              mdi-sort
            </v-icon>
          </div>
        </template>
      </SortingMenu>

      <div
        class="sorting-header__item"
        :is-selected="selectedSortingType.name === selectedSortingHeaderType.name"
        :sorting-order="sortingOrder"
        @click="selectedSortingHeaderType.onClick(selectedSortingHeaderType)"
      >
        <SortingColumnMenu
          :sorting-type="selectedSortingHeaderType"
        >
          <template #activator="{menuActivatorOnProp}">
            <div
              class="sorting-header__item__inner"
              @contextmenu.prevent="menuActivatorOnProp.click"
            >
              <div class="sorting-header__item__title">
                {{$t(selectedSortingHeaderType.shortTitle)}}
              </div>
            </div>
          </template>
        </SortingColumnMenu>
      </div>
    </div>

    <!-- navigator-layout:list -->
    <div
      v-if="navigatorLayout === 'list'"
      class="sorting-header__inner"
      :navigator-layout="navigatorLayout"
      :style="{
        'grid-template-columns': sortingHeaderGridColumnTemplate.join(' ')
      }"
    >
      <SortingMenu>
        <template #activator="{menuActivatorOnProp}">
          <div
            class="sorting-header__item"
            is-sort-icon
            v-on="menuActivatorOnProp"
          >
            <v-icon size="18px">
              mdi-sort
            </v-icon>
          </div>
        </template>
      </SortingMenu>

      <div
        v-for="(sortingType, index) in sortingTypes"
        :key="'item-' + index"
        class="sorting-header__item"
        :is-selected="selectedSortingType.name === sortingType.name"
        :sorting-order="sortingOrder"
        :style="{
          'display': sortingType.isChecked ? 'inline-flex' : 'none'
        }"
        @click="sortingType.onClick(sortingType)"
      >
        <SortingColumnMenu
          :sorting-type="sortingType"
        >
          <template #activator="{menuActivatorOnProp}">
            <div
              class="sorting-header__item__inner"
              @contextmenu.prevent="menuActivatorOnProp.click"
            >
              <div class="sorting-header__item__title">
                {{$t(sortingType.shortTitle)}}
              </div>
            </div>
          </template>
        </SortingColumnMenu>
      </div>
    </div>
  </div>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'
import SortingMenu from './SortingMenu.vue'
import SortingColumnMenu from './SortingColumnMenu.vue'

export default {
  components: {
    SortingMenu,
    SortingColumnMenu,
  },
  mounted () {
    this.setSortingTypes()
  },
  computed: {
    ...mapFields({
      sortingOrder: 'storageData.settings.sorting.order',
      selectedSortingType: 'storageData.settings.sorting.selectedType',
      sortingTypes: 'storageData.settings.sorting.types',
      navigatorLayout: 'storageData.settings.navigatorLayout',
      navigatorSortingElementDisplayType: 'storageData.settings.navigator.sorting.elementDisplayType',
    }),
    ...mapGetters([
      'sortingHeaderGridColumnTemplate',
    ]),
    selectedSortingHeaderType () {
      return this.sortingTypes.find(item => this.selectedSortingType.name === item.name)
    },
  },
  methods: {
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
.sorting-header {
  height: var(--workspace-area-sorting-header-height);
  user-select: none;
}

.sorting-header__inner {
  display: grid;
  border-bottom: 1px solid var(--dir-item-card-border-3);
  align-items: center;
  height: 100%;
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

#app
  .sorting-header
    .v-icon {
      color: var(--highlight-color-1);
    }
</style>