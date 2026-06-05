<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { LoaderCircleIcon } from '@lucide/vue';
import type { ListReorderableColumnId } from '@/types/user-settings';
import type { ItemTag } from '@/types/user-stats';
import { Skeleton } from '@/components/ui/skeleton';
import { TagSelector } from '@/components/ui/tag-selector';
import type { DirEntry } from '@/types/dir-entry';

interface FileBrowserListDateDisplay {
  primary: string;
  absolute: string;
  showHoverSwap: boolean;
}

interface FileBrowserListTagBadge {
  id: string;
  name: string;
  style: Record<string, string>;
}

interface FileBrowserListViewColumnRow {
  entry: DirEntry;
  itemsDisplay: string;
  sizeDisplay: string | null;
  isDirLoadingWithProgress: boolean;
  isSizeSkeletonVisible: boolean;
  modifiedDate: FileBrowserListDateDisplay;
  createdDate: FileBrowserListDateDisplay;
  selectedTagIds: string[];
  tagBadges: FileBrowserListTagBadge[];
  hiddenTagCount: number;
  tagSummary: string;
  isTagSelectorMounted: boolean;
  kindLabel: string;
  linksDisplay: string;
  linkStatusLabel: string;
  isLinkSkeletonVisible: boolean;
}

const props = defineProps<{
  columnId: ListReorderableColumnId;
  row: FileBrowserListViewColumnRow;
  availableTags: ItemTag[];
}>();

const emit = defineEmits<{
  toggleTag: [entry: DirEntry, tagId: string];
  createTag: [entry: DirEntry, name: string];
  renameTag: [tagId: string, name: string];
  updateTagColor: [tagId: string, color: string];
  tagsOpenChange: [entryPath: string, open: boolean];
  openTagSelector: [entryPath: string];
}>();

const columnClass = computed(() => `file-browser-list-view__entry-${props.columnId}`);

const tagsColumnInteractionAttrs = computed(() => {
  if (props.columnId !== 'tags') {
    return {};
  }

  return {
    onMousedown: (event: MouseEvent) => event.stopPropagation(),
    onMouseup: (event: MouseEvent) => event.stopPropagation(),
    onClick: (event: MouseEvent) => event.stopPropagation(),
    onContextmenu: (event: MouseEvent) => event.stopPropagation(),
  };
});
</script>

<template>
  <span
    :class="columnClass"
    v-bind="tagsColumnInteractionAttrs"
  >
    <template v-if="props.columnId === 'items'">
      {{ props.row.itemsDisplay }}
    </template>
    <template v-else-if="props.columnId === 'size'">
      <LoaderCircleIcon
        v-if="props.row.isDirLoadingWithProgress"
        :size="12"
        class="file-browser-list-view__spinner"
      />
      <Skeleton
        v-if="props.row.isSizeSkeletonVisible"
        class="file-browser-list-view__size-skeleton"
      />
      <span
        v-else
        class="file-browser-list-view__column-value"
      >{{ props.row.sizeDisplay }}</span>
    </template>
    <template v-else-if="props.columnId === 'modified'">
      <span
        v-if="props.row.modifiedDate.showHoverSwap"
        class="file-browser-list-view__date-hover file-browser-list-view__date-hover--relative"
      >
        <span class="file-browser-list-view__date-hover-primary">{{ props.row.modifiedDate.primary }}</span>
        <span class="file-browser-list-view__date-hover-absolute">{{ props.row.modifiedDate.absolute }}</span>
      </span>
      <span
        v-else
        class="file-browser-list-view__date-hover"
      >{{ props.row.modifiedDate.primary }}</span>
    </template>
    <template v-else-if="props.columnId === 'created'">
      <span
        v-if="props.row.createdDate.showHoverSwap"
        class="file-browser-list-view__date-hover file-browser-list-view__date-hover--relative"
      >
        <span class="file-browser-list-view__date-hover-primary">{{ props.row.createdDate.primary }}</span>
        <span class="file-browser-list-view__date-hover-absolute">{{ props.row.createdDate.absolute }}</span>
      </span>
      <span
        v-else
        class="file-browser-list-view__date-hover"
      >{{ props.row.createdDate.primary }}</span>
    </template>
    <template v-else-if="props.columnId === 'tags'">
      <TagSelector
        v-if="props.row.isTagSelectorMounted"
        :tags="props.availableTags"
        :selected-tag-ids="props.row.selectedTagIds"
        :allow-create="true"
        :max-badges="1"
        :full-width="true"
        :open-on-mount="true"
        trigger-variant="default"
        align="end"
        side="bottom"
        @toggle-tag="tagId => emit('toggleTag', props.row.entry, tagId)"
        @create-tag="name => emit('createTag', props.row.entry, name)"
        @rename-tag="(tagId, name) => emit('renameTag', tagId, name)"
        @update-tag-color="(tagId, color) => emit('updateTagColor', tagId, color)"
        @open-change="open => emit('tagsOpenChange', props.row.entry.path, open)"
      />
      <button
        v-else
        type="button"
        class="file-browser-list-view__entry-tags-static"
        :title="props.row.tagSummary"
        @click="emit('openTagSelector', props.row.entry.path)"
      >
        <template v-if="props.row.tagBadges.length > 0">
          <span
            v-for="tag in props.row.tagBadges"
            :key="tag.id"
            class="file-browser-list-view__tag-badge"
            :style="tag.style"
          >
            {{ tag.name }}
          </span>
          <span
            v-if="props.row.hiddenTagCount > 0"
            class="file-browser-list-view__tag-badge file-browser-list-view__tag-badge--more"
          >
            +{{ props.row.hiddenTagCount }}
          </span>
        </template>
        <span
          v-else
          class="file-browser-list-view__entry-tags-empty"
        >—</span>
      </button>
    </template>
    <template v-else-if="props.columnId === 'kind'">
      {{ props.row.kindLabel }}
    </template>
    <template v-else-if="props.columnId === 'links'">
      <Skeleton
        v-if="props.row.isLinkSkeletonVisible"
        class="file-browser-list-view__metadata-skeleton"
      />
      <span
        v-else
        class="file-browser-list-view__column-value"
      >{{ props.row.linksDisplay }}</span>
    </template>
    <template v-else-if="props.columnId === 'linkStatus'">
      <Skeleton
        v-if="props.row.isLinkSkeletonVisible"
        class="file-browser-list-view__metadata-skeleton"
      />
      <span
        v-else
        class="file-browser-list-view__column-value"
      >{{ props.row.linkStatusLabel }}</span>
    </template>
  </span>
</template>
