<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'homeBannerPickerDialog'}),
    }"
    :title="$t('dialogs.homeBannerPickerDialog.homePageBackgroundManager')"
    max-width="90vw"
    height="85vh"
  >
    <template #title>
      <InfoTag
        v-if="homeBannerSelectedItem.type === 'video'"
        :text="$t('dialogs.homeBannerPickerDialog.highResourceUsage')"
        class="ml-4"
      >
        <template #tooltip>
          <v-icon color="red">
            mdi-circle-small
          </v-icon>
          {{$t('dialogs.homeBannerPickerDialog.videoBackgroundsUse')}}
        </template>
      </InfoTag>
    </template>

    <template #content>
      <div class="text--sub-title-1 mb-4">
        {{$t('dialogs.homeBannerPickerDialog.customBackgrounds')}}
      </div>

      <!-- iterator::custom-media -->
      <media-iterator
        v-if="dialog.value"
        :items="customHomeBannerItems"
        type="custom"
        :options="{
          loadOnce: true
        }"
      />

      <!-- iterator::default-media::title -->
      <div class="text--sub-title-1 mb-2">
        {{$t('dialogs.homeBannerPickerDialog.defaultBackgrounds')}}
      </div>

      <div class="mb-4">
        <p>
          {{$t('dialogs.homeBannerPickerDialog.artworksProvided')}}
        </p>
      </div>

      <!-- iterator::default-media -->
      <media-iterator
        v-if="dialog.value"
        :items="defaultHomeBannerItems"
        type="default"
        :options="{
          loadOnce: true
        }"
      />
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'
import InfoTag from '@/components/InfoTag/InfoTag.vue'

export default {
  components: {
    InfoTag,
  },
  computed: {
    ...mapState({
      dialog: state => state.dialogs.homeBannerPickerDialog,
      homeBannerSelectedItem: state => state.storageData.settings.homeBanner.selectedItem,
      homeBanner: state => state.storageData.settings.homeBanner,
    }),
    defaultHomeBannerItems () {
      return this.homeBanner.items.filter(item => !item.isCustom)
    },
    customHomeBannerItems () {
      return this.homeBanner.items.filter(item => item.isCustom)
    },
  },
}
</script>

<style scoped>

</style>