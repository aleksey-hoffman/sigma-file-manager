<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SettingsNav, SettingsView } from '@/modules/settings';
import { useSettingsStore } from '@/stores/runtime/settings';

const settingsStore = useSettingsStore();
</script>

<template>
  <div class="settings-content">
    <div class="settings-content__container">
      <div
        :class="['settings-content__inner', {
          'settings-content__inner--search': settingsStore.search
        }]"
      >
        <SettingsNav v-if="!settingsStore.search" />
        <SettingsView />
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-content {
  flex: 1;
  padding: 1.25rem 2rem;
}

.settings-content__container {
  height: 100%;
}

.settings-content__inner {
  display: grid;
  height: 100%;
  gap: 2rem;
  grid-template-columns: 240px 1fr;
}

@media (width <= 768px) {
  .settings-content {
    padding: 1rem;
  }

  .settings-content__inner {
    gap: 1rem;
    grid-template-columns: 1fr;
  }
}

.settings-content__inner--search {
  grid-template-columns: 1fr;
}
</style>
