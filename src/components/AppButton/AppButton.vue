<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-tooltip
    bottom
    :disabled="!tooltip"
    class="app-button"
  >
    <template #activator="{on}">
      <v-btn
        :value="value"
        :icon="!!icon && type === 'icon'"
        :small="small"
        :class="buttonClass"
        :disabled="isDisabled"
        v-on="on"
        @click="onClickHandler"
      >
        <v-icon
          v-if="icon"
          :class="iconClass"
          :size="iconSize"
          v-bind="iconProps"
        >
          {{icon}}
        </v-icon>
        <slot />
        <span
          v-if="shortcut"
          class="app-button__shortcut"
        >
          - {{shortcut}}
        </span>
      </v-btn>
    </template>
    <span>
      <div>
        {{tooltip}}
      </div>
      <div v-if="tooltipShortcuts">
        <div
          v-for="(shortcut, index) in tooltipShortcuts"
          :key="index"
        >
          <span class="inline-code--light">{{shortcut.value}}</span>
          - {{shortcut.description}}
        </div>
      </div>
    </span>
  </v-tooltip>
</template>

<script>
export default {
  props: {
    onClick: {
      type: Function,
      default: () => ({}),
    },
    type: {
      type: String,
      default: 'icon', // 'icon' | 'button'
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
      type: [String, Object],
      default: '',
    },
    buttonClass: {
      type: [String, Object],
      default: 'text', // 'text' | 'button-1' | 'button-2'
    },
    tooltip: {
      type: String,
      default: '',
    },
    shortcut: {
      type: String,
      default: '',
    },
    tooltipShortcuts: {
      type: Array,
      default: () => {
        return []
      },
    },
    iconProps: {
      type: Object,
      default: () => ({}),
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    value: {
      type: String,
      default: '',
    },
    small: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click'],
  methods: {
    onClickHandler (event) {
      if (this.onClick) {
        this.onClick(event)
      }
      this.$emit('click', event)
    },
  },
}
</script>

<style>
.app-button__shortcut {
  margin-left: 2px;
  color: var(--color-7);
  font-size: 12px;
  text-transform: capitalize;
}
</style>