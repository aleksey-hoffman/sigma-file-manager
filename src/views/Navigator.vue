<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div id="navigator-route">
    <ActionToolbar />
    <InfoPanel />
    <Workspace />
  </div>
</template>

<script>
import ActionToolbar from '@/views/NavigatorView/ActionToolbar/ActionToolbar.vue'
import InfoPanel from '@/components/InfoPanel/index.vue'
import Workspace from '@/components/Workspace/index.vue'

export default {
  name: 'navigator',
  components: {
    ActionToolbar,
    InfoPanel,
    Workspace,
  },
  activated () {
    this.$store.dispatch('routeOnActivated', this.$route.name)
  },
  async mounted () {
    this.$nextTick(() => {
      this.$store.dispatch('routeOnMounted', this.$route.name)
    })
  },
}
</script>
