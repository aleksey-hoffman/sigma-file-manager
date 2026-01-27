<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useSettingsStore } from '@/stores/runtime/settings';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppearanceCategory from './categories/appearance/index.vue';
import GeneralCategory from './categories/general/index.vue';
import InputCategory from './categories/input/index.vue';
import SearchCategory from './categories/search/index.vue';
import ShortcutsCategory from './categories/shortcuts/index.vue';
import StatsCategory from './categories/stats/index.vue';
import StorageCategory from './categories/storage/index.vue';

import { Button } from '@/components/ui/button';

const settingsStore = useSettingsStore();
const { t } = useI18n();

const currentTabLabel = computed(() => {
  const currentTab = settingsStore.tabs.find(tab => tab.name === settingsStore.currentTab);
  return currentTab?.label || '';
});

const categoryComponentMap: Record<string, unknown> = {
  general: GeneralCategory,
  appearance: AppearanceCategory,
  input: InputCategory,
  search: SearchCategory,
  shortcuts: ShortcutsCategory,
  stats: StatsCategory,
  storage: StorageCategory,
};

function getComponentForTab(tabName: string) {
  return categoryComponentMap[tabName];
}
</script>

<template>
  <div class="settings-view">
    <div class="settings-view__header">
      <div class="settings-view__title-section">
        <div>
          <h2 class="settings-view__title">
            {{ settingsStore.search ? t('globalSearch.searchResults') : currentTabLabel }}
          </h2>
        </div>
        <Button
          v-if="settingsStore.search"
          variant="tertiary"
          class="settings-view__clear-search"
          @click="settingsStore.clearSearch"
        >
          {{ t('globalSearch.clearSearchField') }}
        </Button>
      </div>
    </div>

    <div class="settings-view__content">
      <component
        v-if="!settingsStore.search && getComponentForTab(settingsStore.currentTab)"
        :is="getComponentForTab(settingsStore.currentTab)"
      />

      <template v-else-if="settingsStore.search">
        <component
          v-for="section in settingsStore.currentTabSections"
          :key="section.key"
          :is="section.component"
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
