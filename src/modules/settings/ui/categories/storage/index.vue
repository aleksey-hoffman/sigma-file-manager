<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useSettingsStore } from '@/stores/runtime/settings';

const settingsStore = useSettingsStore();

const categorySections = computed(() => settingsStore.getSectionsForCategory('storage'));
</script>

<template>
  <div class="settings-category">
    <component
      :is="section.component"
      v-for="section in categorySections"
      :key="section.key"
    />
  </div>
</template>

<style scoped>
.settings-category {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
