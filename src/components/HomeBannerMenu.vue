<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <v-menu
      v-if="$route.name === 'home'"
      bottom offset-y custom
    >
      <template v-slot:activator="{ on: menu }">
        <v-tooltip right>
          <template v-slot:activator="{ on: tooltip }">
            <transition name="fade-in-1s">
              <v-btn
                v-on="{ ...tooltip, ...menu }"
                icon
                class="action-toolbar__item fade-in-1s mt-1"
              >
                <v-icon
                  size="20px"
                  class="home-banner__icon"
                  :home-banner-is-shown="homeBannerValue"
                >mdi-tune
                </v-icon>
              </v-btn>
            </transition>
          </template>
          <span>Media banner options</span>
        </v-tooltip>
      </template>

      <v-list class="pa-0">
        <div v-if="homeBannerValue">
          <v-list-item
            v-for="(item, index) in menuItems"
            :key="index"
            @click="item.onClick()"
          >
            <v-list-item-action>
              <v-icon>{{item.icon}}</v-icon>
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{item.title}}</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </div>

        <div v-if="!homeBannerValue">
          <v-list-item @click="homeBannerValue = !homeBannerValue">
            <v-list-item-action>
              <v-icon>mdi-eye-outline</v-icon>
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>Display media banner</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </div>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
import { mapFields } from 'vuex-map-fields'
export default {
  data: () => ({
    menuItems: []
  }),
  mounted () {
    this.menuItems = [
      {
        title: 'Hide media banner',
        icon: 'mdi-eye-off-outline',
        onClick: () => {this.homeBannerValue = !this.homeBannerValue}
      },
      {
        title: 'Background manager',
        icon: 'mdi-wallpaper',
        onClick: () => {this.dialogs.homeBannerPickerDialog.value = true}
      },
      {
        title: 'Background position',
        icon: 'mdi-axis-x-arrow',
        onClick: () => {this.dialogs.homeBannerPositionDialog.value = true}
      },
      {
        title: 'Background height',
        icon: 'mdi-format-vertical-align-center',
        onClick: () => {this.dialogs.homeBannerHeightDialog.value = true}
      },
      {
        title: 'Background overlay',
        icon: 'mdi-image-filter-black-white',
        onClick: () => {this.dialogs.homeBannerOverlayDialog.value = true}
      },
      {
        title: 'Set default background',
        icon: 'mdi-undo-variant',
        onClick: () => {this.$store.dispatch('RESET_HOME_BANNER_BACKGROUND')}
      }
    ]
  },
  computed: {
    ...mapFields({
      homeBannerValue: 'storageData.settings.homeBanner.value'
    }),
    dialogs () { return this.$store.state.dialogs }
  }
}
</script>

<style>
.home-banner__icon[home-banner-is-shown] {
  color: var(--color-4) !important;
}
</style>
