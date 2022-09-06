<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <ActionToolbarBase v-show="showActionToolbar">
    <!-- menu-button::home-banner -->
    <HomeBannerMenu />
  </ActionToolbarBase>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import ActionToolbarBase from '@/components/ActionToolbarBase/ActionToolbarBase.vue'
import HomeBannerMenu from '@/components/HomeBannerMenu.vue'

export default {
  components: {
    ActionToolbarBase,
    HomeBannerMenu,
  },
  computed: {
    ...mapFields({
      homeBannerValue: 'storageData.settings.homeBanner.value',
    }),
    showActionToolbar () {
      return this.$route.name !== 'home' ||
        (this.$route.name === 'home' && !this.homeBannerValue)
    },
  },
}
</script>
