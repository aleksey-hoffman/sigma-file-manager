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
      <template v-slot:activator="{on}">
        <slot name="activator" :menuActivatorOnProp="on"></slot>
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

        <v-divider></v-divider>

        <v-list-item @click="$store.dispatch('TOGGLE_SORTING_ORDER')">
          <v-icon class="mr-4">
            {{sortingOrder === 'descending' 
              ? 'mdi-chevron-down' 
              : 'mdi-chevron-up'
            }}
          </v-icon>
          <v-list-item-content>
            <span>
              {{sortingOrder === 'descending'
                ? 'Descending order'
                : 'Ascending order'
              }}
            </span>
          </v-list-item-content>
        </v-list-item>

        <v-divider></v-divider>

        <v-list-item
          v-for="(sortingType, index) in sortingTypes"
          :key="index"
          @click="$store.dispatch('SET_SORTING_TYPE', sortingType)"
        >
          <v-list-item-action>
            <v-checkbox
              class="ma-0 pa-0"
              @click.stop=""
              v-model="sortingType.isChecked"
              :readonly="sortingType.name === 'name'" 
              :on-icon="sortingType.name === 'name' ? 'mdi-pin-outline' : undefined"
              hide-details
            ></v-checkbox>
          </v-list-item-action>

          <v-list-item-title>
            {{$utils.toTitleCase(sortingType.title)}}
          </v-list-item-title>
          
          <v-list-item-icon>
            <v-icon 
              class="mr-4"
              v-if="selectedSortingType.name === sortingType.name"
              size="10px"
            >mdi-circle-outline
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
      sortingOrder: 'sorting.order',
      selectedSortingType: 'sorting.selectedType',
      sortingTypes: 'sorting.types',
    }),
  }
}
</script>
