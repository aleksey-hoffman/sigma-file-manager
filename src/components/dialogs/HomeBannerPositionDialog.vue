<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'homeBannerPositionDialog'}),
    }"
    title="Background position"
    height="unset"
  >
    <template #content>
      <div>{{$t('dialogs.homeBannerPositionDialog.positionXAxis')}}: {{homeBannerPositionX}}%</div>
      <v-slider
        v-model="homeBannerPositionX"
        :step="5"
        :thumb-size="24"
      />
      <div>{{$t('dialogs.homeBannerPositionDialog.positionYAxis')}}: {{homeBannerPositionY}}%</div>
      <v-slider
        v-model="homeBannerPositionY"
        :step="5"
        :thumb-size="24"
      />
    </template>
  </dialog-generator>
</template>

<script>
import {mapGetters, mapState} from 'vuex'

export default {
  computed: {
    ...mapGetters([
      'homeBannerSelectedMedia',
    ]),
    ...mapState({
      appVersion: state => state.appVersion,
      appPaths: state => state.storageData.settings.appPaths,
      dialog: state => state.dialogs.homeBannerPositionDialog,
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