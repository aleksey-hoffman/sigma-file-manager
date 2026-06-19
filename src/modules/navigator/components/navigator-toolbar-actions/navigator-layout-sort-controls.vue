<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { ArrowUpIcon, ArrowDownIcon } from '@lucide/vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  FILE_BROWSER_SORT_COLUMNS,
  getFileBrowserListColumnLabel,
  getNavigatorSortColumnChangeUpdates,
  getNavigatorSortSettingsForLayout,
  getNextNavigatorSortDirection,
  getNavigatorSortSettingKeys,
  getResolvedNavigatorSortColumn,
  isListSortColumn,
} from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';

const props = defineProps<{
  sortLayout: 'list' | 'grid';
}>();

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();

const sortSettings = computed(() => getNavigatorSortSettingsForLayout(
  userSettingsStore.userSettings.navigator,
  props.sortLayout,
));
const activeSortColumn = computed(() => getResolvedNavigatorSortColumn(
  userSettingsStore.userSettings.navigator,
  props.sortLayout,
));
const activeSortDirection = computed(() => sortSettings.value.direction);

function handleSortColumnChange(value: unknown) {
  if (typeof value !== 'string' || !isListSortColumn(value)) {
    return;
  }

  const updates = getNavigatorSortColumnChangeUpdates(
    userSettingsStore.userSettings.navigator,
    props.sortLayout,
    value,
  );

  for (const update of updates) {
    userSettingsStore.set(update.key, update.value);
  }
}

function toggleSortDirection() {
  const settingKeys = getNavigatorSortSettingKeys(props.sortLayout);
  userSettingsStore.set(
    settingKeys.direction,
    getNextNavigatorSortDirection(activeSortDirection.value),
  );
}
</script>

<template>
  <div class="navigator-layout-sort-controls">
    <div class="navigator-layout-sort-controls__label">
      {{ t('settings.navigator.sortBy') }}
    </div>
    <div class="navigator-layout-sort-controls__row">
      <Select
        :model-value="activeSortColumn"
        @update:model-value="handleSortColumnChange"
      >
        <SelectTrigger class="navigator-layout-sort-controls__select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="column in FILE_BROWSER_SORT_COLUMNS"
            :key="column"
            :value="column"
          >
            <SelectItemText>{{ getFileBrowserListColumnLabel(t, column) }}</SelectItemText>
          </SelectItem>
        </SelectContent>
      </Select>
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="navigator-layout-sort-controls__direction"
            :aria-label="activeSortDirection === 'asc'
              ? t('settings.navigator.sortAscending')
              : t('settings.navigator.sortDescending')"
            @click="toggleSortDirection"
          >
            <ArrowUpIcon
              v-if="activeSortDirection === 'asc'"
              :size="16"
            />
            <ArrowDownIcon
              v-else
              :size="16"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {{
            activeSortDirection === 'asc'
              ? t('settings.navigator.sortAscending')
              : t('settings.navigator.sortDescending')
          }}
        </TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>

<style>
.navigator-layout-sort-controls {
  display: flex;
  width: 100%;
  flex-direction: column;
  margin-top: 4px;
  gap: 4px;
}

.navigator-layout-sort-controls__label {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.navigator-layout-sort-controls__row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 6px;
}

.navigator-layout-sort-controls__select.sigma-ui-select-trigger {
  height: 28px;
  flex: 1;
  font-size: 12px;
}

.navigator-layout-sort-controls__direction {
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.navigator-layout-sort-controls__direction:hover {
  background-color: hsl(var(--secondary));
}

.navigator-layout-sort-controls__direction:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}
</style>
