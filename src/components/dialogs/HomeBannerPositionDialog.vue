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
    title="Background position"
  >
    <v-card
      class="dialog-card pa-8"
    >
      <div>{{$t('dialogs.homeBannerPositionDialog.positionXAxis')}}: {{homeBannerPositionX}}%</div>
      <v-slider
        v-model="homeBannerPositionX"
        :step="1"
        :thumb-size="24"
      />
      <div>{{$t('dialogs.homeBannerPositionDialog.positionYAxis')}}: {{homeBannerPositionY}}%</div>
      <v-slider
        v-model="homeBannerPositionY"
        :step="1"
        :thumb-size="24"
      />
    </v-card>
  </v-bottom-sheet>
</template>

<script>
import {mapGetters, mapState} from 'vuex'
import {mapFields} from 'vuex-map-fields'

export default {
  computed: {
    ...mapGetters([
      'homeBannerSelectedMedia',
    ]),
    ...mapState({
      appVersion: state => state.appVersion,
      appPaths: state => state.storageData.settings.appPaths,
    }),
    ...mapFields({
      dialog: 'dialogs.homeBannerPositionDialog',
    }),
    homeBannerPositionX: {
      get () {return this.homeBannerSelectedMedia.positionX},
      set (value) {
        this.$store.dispatch('SET_HOME_BANNER_POSITION', {axis: 'x', value: value})
      },
    },
    homeBannerPositionY: {
      get () {return this.homeBannerSelectedMedia.positionY},
      set (value) {
        this.$store.dispatch('SET_HOME_BANNER_POSITION', {axis: 'y', value: value})
      },
    },
  },
}
</script>

<style scoped>

</style>