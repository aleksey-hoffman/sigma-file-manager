<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useSettingsStore } from '../stores/store';
import { computed } from 'vue';

import AppearanceCategory from './categories/appearance/index.vue';
import GeneralCategory from './categories/general/index.vue';

import ThemeSection from './categories/appearance/theme.vue';
import LanguageSection from './categories/general/language.vue';
import WindowScalingSection from './categories/general/window-scaling.vue';
import { Button } from '@/components/ui/button';

const settingsStore = useSettingsStore();

const currentTabLabel = computed(() => {
  const currentTab = settingsStore.tabs.find(tab => tab.name === settingsStore.currentTab);
  return currentTab?.label || '';
});

const categoryComponentMap: Record<string, unknown> = {
  general: GeneralCategory,
  appearance: AppearanceCategory,
};

const sectionComponentMap: Record<string, unknown> = {
  theme: ThemeSection,
  language: LanguageSection,
  uiScaling: WindowScalingSection,
};

function getComponentForTab(tabName: string) {
  return categoryComponentMap[tabName];
}

function getSectionComponent(sectionKey: string) {
  return sectionComponentMap[sectionKey];
}

const settingsWithComponents = computed(() => {
  if (!settingsStore.search) {
    return settingsStore.currentTabSettings;
  }

  return settingsStore.currentTabSettings.filter(setting => getSectionComponent(setting.key));
});
</script>

<template>
  <div class="settings-view">
    <div class="settings-view__header">
      <div class="settings-view__title-section">
        <div>
          <h2 class="settings-view__title">
            {{ settingsStore.search ? 'Search Results' : currentTabLabel }}
          </h2>
          <p
            v-if="settingsStore.search"
            class="settings-view__search-info"
          >
            Showing {{ settingsWithComponents.length }} result{{ settingsWithComponents.length !== 1 ? 's' : '' }}
            for "{{ settingsStore.search }}"
          </p>
        </div>
        <Button
          v-if="settingsStore.search"
          variant="tertiary"
          class="settings-view__clear-search"
          @click="settingsStore.clearSearch"
        >
          Clear Search
        </Button>
      </div>
    </div>

    <div class="settings-view__content">
      <!-- Static category when not searching -->
      <component
        v-if="!settingsStore.search && getComponentForTab(settingsStore.currentTab)"
        :is="getComponentForTab(settingsStore.currentTab)"
      />

      <!-- When searching: show actual functional section components -->
      <template v-else-if="settingsStore.search">
        <component
          v-for="setting in settingsWithComponents"
          :key="setting.key"
          :is="getSectionComponent(setting.key)"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
}

.settings-view__header {
  padding-bottom: 1rem;
  border-bottom: 1px solid hsl(var(--border));
}

.settings-view__title-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.settings-view__title {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 1.5rem;
  font-weight: 600;
}

.settings-view__search-info {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.settings-view__content {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}
</style>
