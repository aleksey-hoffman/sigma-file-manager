<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div v-if="filterQuery.length > 0">
    <v-btn
      small
      class="button-1"
      @click="$emit('click')"
    >
      <v-icon
        size="16px"
        class="mr-2"
      >
        mdi-backspace-outline
      </v-icon>
      {{$t('filter.clearFilter')}}
    </v-btn>
  </div>
</template>

<script>
export default {
  props: {
    filterQuery: {
      type: String,
      default: '',
    },
  },
}
</script>