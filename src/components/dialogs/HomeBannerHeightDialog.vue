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
    :title="$t('home.backgroundHeight')"
  >
    <v-card class="dialog-card pa-8">
      <div>{{$t('height')}}: {{homeBannerHeight}}{{$t('units.vh')}}</div>
      <v-slider
        v-model="homeBannerHeight"
        :step="0.1"
        :thumb-size="24"
        :min="38"
        :max="75"
      />
    </v-card>
  </v-bottom-sheet>
</template>

<script>
import {mapState} from 'vuex'

export default {
  computed: {
    ...mapState({
      dialog: state => state.dialogs.homeBannerHeightDialog,
    }),
    homeBannerHeight: {
      get () {return this.$store.state.storageData.settings.homeBanner.height},
      set (value) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.homeBanner.height',
          value: value,
        })
      },
    },
  },
}
</script>

<style scoped>

</style>