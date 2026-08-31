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
import {
  FILE_BROWSER_SORT_COLUMNS,
  getFileBrowserListColumnLabel,
  getNavigatorSortColumnChangePatch,
  getNavigatorSortSettingsForLayout,
  getNextNavigatorSortDirection,
  getResolvedNavigatorSortColumn,
  isListSortColumn,
  type NavigatorSortSource,
} from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';
import type { NavigatorFolderSettingsPatch } from '@/modules/navigator/utils/resolve-navigator-folder-settings';

const props = defineProps<{
  sortLayout: 'list' | 'grid' | 'gallery';
  sortSource: NavigatorSortSource;
}>();

const emit = defineEmits<{
  persist: [patch: NavigatorFolderSettingsPatch];
}>();

const { t } = useI18n();

const sortSettings = computed(() => getNavigatorSortSettingsForLayout(
  props.sortSource,
  props.sortLayout,
));
const activeSortColumn = computed(() => getResolvedNavigatorSortColumn(
  props.sortSource,
  props.sortLayout,
));
const activeSortDirection = computed(() => sortSettings.value.direction);

function handleSortColumnChange(value: unknown) {
  if (typeof value !== 'string' || !isListSortColumn(value)) {
    return;
  }

  emit('persist', getNavigatorSortColumnChangePatch(
    props.sortSource,
    props.sortLayout,
    value,
  ));
}

function toggleSortDirection() {
  const nextDirection = getNextNavigatorSortDirection(activeSortDirection.value);

  emit('persist', props.sortLayout === 'grid' || props.sortLayout === 'gallery'
    ? { gridSortDirection: nextDirection }
    : { listSortDirection: nextDirection });
}
</script>

<template>
  <div class="navigator-layout-sort-controls">
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
</template>

<style>
.navigator-layout-sort-controls {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 6px;
}

.navigator-layout-sort-controls__select.sigma-ui-select-trigger {
  height: 28px;
  flex: 1;
  border: none;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--secondary) / 60%);
  font-size: 12px;
}

.navigator-layout-sort-controls__select.sigma-ui-select-trigger:hover {
  background-color: hsl(var(--secondary));
}

.navigator-layout-sort-controls__direction {
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--secondary) / 60%);
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
