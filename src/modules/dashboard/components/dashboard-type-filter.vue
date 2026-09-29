<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArchiveIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  MoreHorizontalIcon,
  VideoIcon,
} from '@lucide/vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TAGGED_ITEM_TYPE_FILTERS,
  type TaggedItemTypeFilter,
} from '@/utils/tagged-item-type-filter';

const INLINE_FILTER_COUNT = 3;

const FILTER_PRESENTATION: Record<TaggedItemTypeFilter, {
  labelKey: string;
  icon: Component | null;
}> = {
  all: {
    labelKey: 'dashboard.typeFilter.all',
    icon: null,
  },
  folders: {
    labelKey: 'fileBrowser.folders',
    icon: FolderIcon,
  },
  files: {
    labelKey: 'files',
    icon: FileIcon,
  },
  documents: {
    labelKey: 'dashboard.typeFilter.documents',
    icon: FileTextIcon,
  },
  images: {
    labelKey: 'images',
    icon: ImageIcon,
  },
  videos: {
    labelKey: 'videos',
    icon: VideoIcon,
  },
  archives: {
    labelKey: 'dashboard.typeFilter.archives',
    icon: ArchiveIcon,
  },
};

const filter = defineModel<TaggedItemTypeFilter>({ required: true });

const { t } = useI18n();

const filterOptions = computed(() => {
  return TAGGED_ITEM_TYPE_FILTERS.map(value => ({
    value,
    label: t(FILTER_PRESENTATION[value].labelKey),
    icon: FILTER_PRESENTATION[value].icon,
  }));
});
const inlineOptions = computed(() => filterOptions.value.slice(0, INLINE_FILTER_COUNT));
const overflowOptions = computed(() => filterOptions.value.slice(INLINE_FILTER_COUNT));
const activeOverflowOption = computed(() => {
  return overflowOptions.value.find(option => option.value === filter.value) ?? null;
});

function selectFilter(value: unknown) {
  const nextFilter = TAGGED_ITEM_TYPE_FILTERS.find(candidate => candidate === value);

  if (nextFilter) {
    filter.value = nextFilter;
  }
}
</script>

<template>
  <Tabs
    :model-value="filter"
    class="dashboard-type-filter"
    @update:model-value="selectFilter"
  >
    <TabsList
      class="dashboard-type-filter__list"
      :aria-label="t('dashboard.typeFilter.label')"
    >
      <TabsTrigger
        v-for="option in inlineOptions"
        :key="option.value"
        :value="option.value"
        class="dashboard-type-filter__trigger"
        :aria-label="option.label"
      >
        <component
          :is="option.icon"
          v-if="option.icon"
          :size="14"
        />
        <span
          class="dashboard-type-filter__label"
          :class="{ 'dashboard-type-filter__label--collapsible': option.icon }"
        >{{ option.label }}</span>
      </TabsTrigger>
      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                class="dashboard-type-filter__more"
                :class="{ 'dashboard-type-filter__more--active': activeOverflowOption }"
                :aria-label="t('dashboard.typeFilter.more')"
              >
                <template v-if="activeOverflowOption">
                  <component
                    :is="activeOverflowOption.icon"
                    v-if="activeOverflowOption.icon"
                    :size="14"
                  />
                  <span class="dashboard-type-filter__label dashboard-type-filter__label--collapsible">
                    {{ activeOverflowOption.label }}
                  </span>
                </template>
                <MoreHorizontalIcon :size="14" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {{ t('dashboard.typeFilter.more') }}
          </TooltipContent>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              :model-value="filter"
              @update:model-value="selectFilter"
            >
              <DropdownMenuRadioItem
                v-for="option in overflowOptions"
                :key="option.value"
                :value="option.value"
                class="dashboard-type-filter__menu-item"
              >
                <component
                  :is="option.icon"
                  v-if="option.icon"
                  :size="14"
                />
                <span>{{ option.label }}</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>
    </TabsList>
  </Tabs>
</template>

<style>
.dashboard-type-filter__list.sigma-ui-tabs-list {
  height: 2.25rem;
  padding: 3px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  gap: 2px;
}

.dashboard-type-filter__trigger.sigma-ui-tabs-trigger {
  flex: 0 0 auto;
  font-size: 0.8125rem;
  gap: 6px;
  padding-inline: 0.75rem;
}

.dashboard-type-filter__more {
  display: inline-flex;
  height: 100%;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 0.625rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  gap: 6px;
  transition: background-color 150ms ease, color 150ms ease;
  white-space: nowrap;
}

.dashboard-type-filter__more:hover,
.dashboard-type-filter__more[data-state="open"] {
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.dashboard-type-filter__more--active {
  background-color: hsl(var(--muted));
  box-shadow:
    0 1px 3px 0 rgb(0 0 0 / 10%),
    0 1px 2px -1px rgb(0 0 0 / 10%);
  color: hsl(var(--foreground));
}

.dashboard-type-filter__menu-item.sigma-ui-dropdown-menu-radio-item {
  padding-left: 0.5rem;
  gap: 8px;
}

.dashboard-type-filter__menu-item .sigma-ui-dropdown-menu-radio-item__indicator {
  display: none;
}

.dashboard-type-filter__menu-item.sigma-ui-dropdown-menu-radio-item[data-state="checked"] {
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
}

@media (width <= 1100px) {
  .dashboard-type-filter__label--collapsible {
    display: none;
  }
}

@media (480px < width <= 768px) {
  .dashboard-type-filter__label--collapsible {
    display: inline;
  }
}

@media (width <= 768px) {
  .dashboard-type-filter,
  .dashboard-type-filter__list.sigma-ui-tabs-list {
    width: 100%;
  }

  .dashboard-type-filter__trigger.sigma-ui-tabs-trigger,
  .dashboard-type-filter__more {
    flex: 1 0 auto;
  }
}
</style>
