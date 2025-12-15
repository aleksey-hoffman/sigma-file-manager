<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SettingsNavItem } from '@/modules/settings';
import { useSettingsStore } from '../stores/store';

const settingsStore = useSettingsStore();
</script>

<template>
  <div
    v-if="!settingsStore.search"
    class="settings-nav"
  >
    <div class="settings-nav__items">
      <SettingsNavItem
        v-for="tab in settingsStore.tabs"
        :key="tab.name"
        :name="tab.name"
        :label="tab.label"
      />
    </div>
  </div>
</template>

<style scoped>
.settings-nav {
  display: flex;
  flex-direction: column;
  padding-right: 1rem;
  border-right: 1px solid hsl(var(--border));
  gap: 1rem;
}

.settings-nav__items {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
