<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-bottom-sheet
    v-model="dialog.value"
    hide-overlay
    inset
    max-width="600px"
    :title="$t('home.backgroundOverlay')"
  >
    <v-card
      class="dialog-card pa-8"
    >
      <div class="text--sub-title-1 ma-0 mr-2">
        {{$t('dialogs.homeBannerOverlayDialog.overlayType')}}
      </div>
      <v-select
        v-model="homeBannerOverlaySelectedItem"
        :items="$store.state.storageData.settings.homeBanner.overlay.items"
        return-object
        item-text="title"
      />
      <template v-if="homeBannerOverlaySelectedItem.name !== 'none'">
        <div class="text--sub-title-1 ma-0 mr-2">
          {{$t('dialogs.homeBannerOverlayDialog.overlayOptions')}}
        </div>

        <!-- input::option:height -->
        <v-text-field
          v-if="homeBannerOverlaySelectedItem.name === 'overlayFade'"
          v-model="homeBannerOverlaySelectedItem.params.topFadeHeight"
          :label="$t('dialogs.homeBannerOverlayDialog.topOverlayHeight')"
        />

        <v-text-field
          v-if="homeBannerOverlaySelectedItem.name === 'overlayFade'"
          v-model="homeBannerOverlaySelectedItem.params.bottomFadeHeight"
          :label="$t('dialogs.homeBannerOverlayDialog.bottomOverlayHeight')"
        />

        <v-text-field
          v-if="homeBannerOverlaySelectedItem.name === 'maskFade'"
          v-model="homeBannerOverlaySelectedItem.params.bottomMaskHeight"
          :label="$t('dialogs.homeBannerOverlayDialog.bottomMaskHeight')"
        />
      </template>
    </v-card>
  </v-bottom-sheet>
</template>

<script>
import {mapState} from 'vuex'

export default {
  computed: {
    ...mapState({
      dialog: state => state.dialogs.homeBannerOverlayDialog,
    }),
    homeBannerOverlaySelectedItem: {
      get () {return this.$store.state.storageData.settings.homeBanner.overlay.selectedItem},
      set (value) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.homeBanner.overlay.selectedItem',
          value: value,
        })
      },
    },
  },
}
</script>

<style scoped>

</style>