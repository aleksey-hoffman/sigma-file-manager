<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div id="navigator-route">
    <InfoPanel />
    <Workspace />
  </div>
</template>

<script>
import InfoPanel from '@/components/InfoPanel/index.vue'
import Workspace from '@/components/Workspace/index.vue'

export default {
  name: 'navigator',
  components: {
    InfoPanel,
    Workspace,
  },
  beforeRouteLeave (to, from, next) {
    this.$store.dispatch('SAVE_ROUTE_SCROLL_POSITION', {
      toRoute: to,
      fromRoute: from,
    })
    next()
  },
  activated () {
    this.$store.dispatch('ROUTE_ACTIVATED_HOOK_CALLBACK', {
      route: 'navigator',
    })
  },
  async mounted () {
    this.$nextTick(() => {
      this.$store.dispatch('ROUTE_MOUNTED_HOOK_CALLBACK', {
        route: 'navigator',
      })
    })
  },
}
</script>
