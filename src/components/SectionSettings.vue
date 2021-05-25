<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div class="settings-section">
    <div class="settings-section__header">
      <div class="settings-section__header__icon">
        <v-icon
          :size="header.icon.size || '22px'"
        >
          {{header.icon.name}}
        </v-icon>
      </div>
      <div class="settings-section__header__title">
        {{header.title}}
      </div>
    </div>
    <div class="settings-section__description">
      <slot name="description"></slot>
    </div>
    <div class="settings-section__content">
      <slot name="content"></slot>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    header: Object
  },
  data () {
    return {
    }
  }
}
</script>

<style>
.settings-section__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-section__header__title {
  font-size: 22px;
  color: var(--title-color-1);
}

.settings-section__header__icon .v-icon {
  width: 32px;
  color: var(--icon-color-2);
}

.settings-section {
  /* display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0px 128px; */
  padding: 32px 8px;
}

.settings-section:nth-child(1) {
  padding-top: 24px;
}

.settings-section__description {
  margin: 8px 0;
}
</style>
