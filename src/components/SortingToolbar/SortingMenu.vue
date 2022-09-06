<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <v-menu
      :close-on-content-click="false"
      offset-y
    >
      <template #activator="{on: onMenu, attrs}">
        <v-tooltip
          bottom
          :disabled="attrs['aria-expanded'] === 'true'"
        >
          <template #activator="{on: onTooltip}">
            <div v-on="{...onTooltip, ...onMenu}">
              <slot
                name="activator"
                :menuActivatorOnProp="onTooltip"
              />
            </div>
          </template>
          <span>Sorting options</span>
        </v-tooltip>
      </template>
      <v-list dense>
        <v-list-item class="inactive">
          <v-list-item-content>
            <v-list-item-title>
              <div class="text--sub-title-1 ma-0">
                Sorting options
              </div>
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>

        <v-divider />

        <v-list-item @click="$store.dispatch('TOGGLE_SORTING_ORDER')">
          <v-icon class="mr-4">
            {{sortingOrder === 'descending'
              ? 'mdi-chevron-down'
              : 'mdi-chevron-up'}}
          </v-icon>
          <v-list-item-content>
            <span>
              {{sortingOrder === 'descending'
                ? 'Descending order'
                : 'Ascending order'}}
            </span>
          </v-list-item-content>
        </v-list-item>

        <v-divider />

        <v-list-item
          v-for="(sortingType, index) in sortingTypes"
          :key="index"
          @click="$store.dispatch('SET_SORTING_TYPE', sortingType)"
        >
          <v-list-item-action>
            <v-checkbox
              v-model="sortingType.isChecked"
              class="ma-0 pa-0"
              :readonly="sortingType.name === 'name'"
              :on-icon="sortingType.name === 'name' ? 'mdi-pin-outline' : undefined"
              hide-details
              @click.stop=""
            />
          </v-list-item-action>

          <v-list-item-title>
            {{$utils.toTitleCase(sortingType.title)}}
          </v-list-item-title>

          <v-list-item-icon>
            <v-icon
              v-if="selectedSortingType.name === sortingType.name"
              class="mr-4"
              size="10px"
            >
              mdi-circle-outline
            </v-icon>
          </v-list-item-icon>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  computed: {
    ...mapFields({
      sortingOrder: 'storageData.settings.sorting.order',
      selectedSortingType: 'storageData.settings.sorting.selectedType',
      sortingTypes: 'storageData.settings.sorting.types',
    }),
  },
}
</script>
