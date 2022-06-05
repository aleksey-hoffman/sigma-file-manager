<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-tooltip bottom>
    <template #activator="{on}">
      <v-btn
        icon
        v-on="on"
        @click="onClick"
      >
        <v-icon
          :class="iconClass"
          :size="iconSize"
        >
          {{icon}}
        </v-icon>
      </v-btn>
    </template>
    <span>{{tooltip}}</span>
  </v-tooltip>
</template>

<script>
export default {
  props: {
    onClick: {
      type: Function,
      default: () => {},
    },
    icon: {
      type: String,
      default: '',
    },
    iconSize: {
      type: String,
      default: '20px',
    },
    iconClass: {
      type: String,
      default: '',
    },
    tooltip: {
      type: String,
      default: '',
    },
  },
}
</script>