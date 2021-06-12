<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <v-menu
      :value="value"
      @change="$emit('input', value)"
      offset-y
      :close-on-content-click="false"
      style="overflow: hidden"
    >
      <template v-slot:activator="{ on: menu, attrs }">
        <v-tooltip bottom :disabled="attrs['aria-expanded'] === 'true'">
          <template v-slot:activator="{ on: tooltip }">
            <v-btn
              v-on="{ ...tooltip, ...menu }"
              icon
              :retain-focus-on-click="false"
              :class="menuButton.class"
            >
              <v-badge
                :value="notificationBadge.value"
                :color="notificationBadge.color"
                dot overlap bottom
              >
                <v-icon
                  :color="header.icon.color"
                  :size="header.icon.size"
                >{{header.icon.name}}
                </v-icon>
              </v-badge>
            </v-btn>
          </template>
          <span>
            <div
              class="tooltip__description"
              v-html="menuButton.tooltip.description"
            ></div>
            <div
              class="tooltip__shortcut"
              v-html="menuButton.tooltip.shortcut"
            ></div>
          </span>
        </v-tooltip>
      </template>

      <div class="menu-container" style="width: 400px">
        <v-list class="inactive">
          <v-list-item dense class="inactive">
            <v-list-item-content>
              <v-list-item-title>
                <div class="text--sub-title-1 ma-0">
                  {{header.title}}
                </div>
              </v-list-item-title>
            </v-list-item-content>
            <v-list-item-action
              v-for="(button, index) in header.buttons"
              :key="'header-button-' + index"
            >
              <v-tooltip bottom>
                <template v-slot:activator="{ on: tooltip }">
                  <v-btn
                    v-on="tooltip"
                    @click="button.onClick"
                    icon
                  >
                    <v-icon :size="button.icon.size">
                      {{button.icon.name}}
                    </v-icon>
                  </v-btn>
                </template>
                <span>
                  {{button.tooltip.description}}
                </span>
              </v-tooltip>
            </v-list-item-action>
          </v-list-item>
        </v-list>

        <v-divider></v-divider>

        <slot name="content"></slot>
      </div>
    </v-menu>
  </div>
</template>

<script>
export default {
  props: {
    value: Boolean,
    model: Boolean,
    menuButton: Object,
    notificationBadge: {
      type: Object,
      default: () => {
        return {
          value: false,
          color: 'blue'
        }
      }
    },
    header: Object
  },
  data () {
    return {
    }
  }
}
</script>

<style>
.menu-container {
  overflow: hidden;
  width: 100%
}
</style>
