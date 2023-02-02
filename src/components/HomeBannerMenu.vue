<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <AppMenuButton
    button-class="action-toolbar__item"
    icon="mdi-tune"
    icon-size="20px"
    :icon-class="{
      'home-banner__icon': !homeBannerValue,
      'home-banner__icon--banner-enabled': homeBannerValue
    }"
    :tooltip="$t('home.mediaBannerOptions')"
    :menu-items="menuItems"
  />
</template>

<script>
import AppMenuButton from '@/components/AppMenuButton/AppMenuButton.vue'

export default {
  components: {
    AppMenuButton,
  },
  computed: {
    menuItems () {
      return this.homeBannerValue ? this.menuItemsBannerEnabled : this.menuItemsBannerDisabled
    },
    menuItemsBannerDisabled () {
      return [
        {
          title: this.$t('home.displayMediaBanner'),
          icon: 'mdi-eye-outline',
          onClick: () => {this.homeBannerValue = !this.homeBannerValue},
        },
      ]
    },
    menuItemsBannerEnabled () {
      return [
        {
          title: this.$t('home.hideMediaBanner'),
          icon: 'mdi-eye-off-outline',
          onClick: () => {this.homeBannerValue = !this.homeBannerValue},
        },
        {
          title: this.$t('home.backgroundManager'),
          icon: 'mdi-wallpaper',
          onClick: () => {this.dialogs.homeBannerPickerDialog.value = true},
        },
        {
          title: this.$t('home.backgroundPosition'),
          icon: 'mdi-axis-x-arrow',
          onClick: () => {this.dialogs.homeBannerPositionDialog.value = true},
        },
        {
          title: this.$t('home.backgroundHeight'),
          icon: 'mdi-format-vertical-align-center',
          onClick: () => {this.dialogs.homeBannerHeightDialog.value = true},
        },
        {
          title: this.$t('home.backgroundOverlay'),
          icon: 'mdi-image-filter-black-white',
          onClick: () => {this.dialogs.homeBannerOverlayDialog.value = true},
        },
        {
          title: this.$t('home.setDefaultBackground'),
          icon: 'mdi-undo-variant',
          onClick: () => {this.$store.dispatch('resetHomeBannerBackground')},
        },
      ]
    },
    dialogs () {return this.$store.state.dialogs},
    homeBannerValue: {
      get () {
        return this.$store.state.storageData.settings.homeBanner.value
      },
      set (value) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.homeBanner.value',
          value,
        })
      },
    },
  },
}
</script>

<style>
#app
  .home-banner__icon--banner-enabled {
    color: var(--color-4);
  }
</style>
