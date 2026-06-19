<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  InfoIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  LoaderCircleIcon,
} from '@lucide/vue';
import type { ListReorderableColumnId, ListSortColumn, ListSortDirection } from '@/types/user-settings';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import FileBrowserListHeaderCell from './file-browser-list-header-cell.vue';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import { getFileBrowserListColumnLabel } from './utils/file-browser-sort-columns';

const props = defineProps<{
  columnId: ListReorderableColumnId;
  listSortColumn: ListSortColumn | null;
  listSortDirection: ListSortDirection;
}>();

const emit = defineEmits<{
  sort: [column: ListSortColumn];
}>();

const { t } = useI18n();
const ctx = useFileBrowserContext();
const legendSizeText = '1.5 GB';

function getColumnLabel() {
  return getFileBrowserListColumnLabel(t, props.columnId);
}
</script>

<template>
  <FileBrowserListHeaderCell :column-id="props.columnId">
    <Tooltip v-if="props.columnId === 'size'">
      <TooltipTrigger as-child>
        <button
          type="button"
          class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable file-browser-list-view__header-size file-browser-list-view__header-size--with-info"
          @click="emit('sort', props.columnId)"
        >
          {{ getColumnLabel() }}
          <InfoIcon
            :size="12"
            class="file-browser-list-view__header-info-icon"
          />
          <ArrowUpIcon
            v-if="props.listSortColumn === props.columnId && props.listSortDirection === 'asc'"
            :size="12"
            class="file-browser-list-view__header-sort-icon"
          />
          <ArrowDownIcon
            v-else-if="props.listSortColumn === props.columnId && props.listSortDirection === 'desc'"
            :size="12"
            class="file-browser-list-view__header-sort-icon"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        :side-offset="8"
        class="file-browser-list-view__size-tooltip"
      >
        <div class="file-browser-list-view__size-tooltip-content">
          <div class="file-browser-list-view__size-tooltip-title">
            {{ t('fileBrowser.sizeTooltip.title') }}
          </div>
          <div class="file-browser-list-view__size-tooltip-body">
            <div class="file-browser-list-view__size-tooltip-item">
              <span class="file-browser-list-view__size-tooltip-label">{{ legendSizeText }}</span>
              <span class="file-browser-list-view__size-tooltip-desc">{{ t('fileBrowser.sizeTooltip.exact') }}</span>
            </div>
            <div class="file-browser-list-view__size-tooltip-item">
              <span class="file-browser-list-view__size-tooltip-label file-browser-list-view__size-tooltip-label--loading">
                <Skeleton class="file-browser-list-view__size-tooltip-skeleton" />
              </span>
              <span class="file-browser-list-view__size-tooltip-desc">{{ t('fileBrowser.sizeTooltip.loading') }}</span>
            </div>
            <div class="file-browser-list-view__size-tooltip-item">
              <span class="file-browser-list-view__size-tooltip-label file-browser-list-view__size-tooltip-label--empty">—</span>
              <span class="file-browser-list-view__size-tooltip-desc">{{ t('fileBrowser.sizeTooltip.notCalculated') }}</span>
            </div>
          </div>
          <div class="file-browser-list-view__size-tooltip-note">
            {{ t('fileBrowser.sizeTooltip.note') }}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
    <button
      v-else
      type="button"
      class="file-browser-list-view__header-item file-browser-list-view__header-item--sortable"
      :class="`file-browser-list-view__header-${props.columnId}`"
      @click="emit('sort', props.columnId)"
    >
      {{ getColumnLabel() }}
      <LoaderCircleIcon
        v-if="(props.columnId === 'kind' || props.columnId === 'links' || props.columnId === 'linkStatus') && ctx.isLinkMetadataLoading.value"
        :size="12"
        class="file-browser-list-view__header-loading-icon"
      />
      <ArrowUpIcon
        v-if="props.listSortColumn === props.columnId && props.listSortDirection === 'asc'"
        :size="12"
        class="file-browser-list-view__header-sort-icon"
      />
      <ArrowDownIcon
        v-else-if="props.listSortColumn === props.columnId && props.listSortDirection === 'desc'"
        :size="12"
        class="file-browser-list-view__header-sort-icon"
      />
    </button>
  </FileBrowserListHeaderCell>
</template>
