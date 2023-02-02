<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <ItemCard
      :line1="userDir.title"
      :icon="userDir.icon"
      :path="userDir.path"
      :name="userDir.name"
      target-type="userDir"
    />
  </div>
</template>

<script>
import ItemCard from '@/components/ItemCard/ItemCard.vue'

export default {
  props: {
    userDir: {
      type: Object,
      default: () => ({
        line1: {
          type: String,
          default: '',
        },
        line2: {
          type: String,
          default: '',
        },
        icon: {
          type: String,
          default: '',
        },
        path: {
          type: String,
          default: '',
        },
      }),
    },
  },
  components: {
    ItemCard,
  },
}
</script>
