<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <v-tooltip
      bottom
      max-width="300px"
    >
      <template #activator="{on}">
        <div
          class="info-tag"
          v-on="on"
        >
          <v-icon size="15px">
            mdi-information-outline
          </v-icon>
          {{text}}
        </div>
      </template>
      <span>
        <slot name="tooltip" />
      </span>
    </v-tooltip>
  </div>
</template>

<script>
export default {
  props: {
    text: {
      type: String,
      default: '',
    },
  },
}
</script>

<style>
.info-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  padding: 1px 8px;
  color: rgba(255, 255, 255, 0.7);
  background-color: rgba(208, 77, 67, 0.65);
  border-radius: 16px;
  font-size: 14px;
  user-select: none;
  cursor: default;
}

#app
  .info-tag
    .v-icon {
      margin-right: 4px;
      color: rgba(255, 255, 255, 0.7) !important;
    }
</style>