<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-menu offset-y>
    <template #activator="{on: onMenu, attrs}">
      <v-tooltip
        bottom
        :disabled="attrs['aria-expanded'] === 'true' || !tooltip"
      >
        <template #activator="{on: onTooltip}">
          <v-btn
            small
            :value="value"
            :disabled="isDisabled"
            class="button-1"
            v-on="{...onTooltip, ...onMenu}"
            @click="onClickHandler"
          >
            {{title}}
            <v-icon class="ml-2">
              mdi-menu-down
            </v-icon>
          </v-btn>
        </template>
        <span>{{tooltip}}</span>
      </v-tooltip>
    </template>
    <v-list dense>
      <v-list-item
        v-for="(item, index) in menuItems"
        :key="index"
        v-bind="menuItemAttributes"
        @click="item.onClick"
      >
        <div class="mr-4">
          <v-icon :size="item.iconSize || '18px'">
            {{item.icon}}
          </v-icon>
        </div>

        <v-list-item-content v-if="item.subtitle">
          <v-list-item-title>
            {{item.title}}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{item.subtitle}}
          </v-list-item-subtitle>
        </v-list-item-content>

        <v-list-item-title v-else>
          {{item.title}}
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
export default {
  props: {
    onClick: {
      type: Function,
      default: () => ({}),
    },
    title: {
      type: String,
      default: '',
    },
    tooltip: {
      type: String,
      default: '',
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    value: {
      type: String,
      default: '',
    },
    menuItems: {
      type: Array,
      default: () => ([
        {
          onClick: () => ({}),
          icon: '',
          title: '',
        },
      ]),
    },
    menuItemAttributes: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ['click'],
  methods: {
    onClickHandler () {
      if (this.onClick) {
        this.onClick()
      }
      this.$emit('click')
    },
  },
}
</script>