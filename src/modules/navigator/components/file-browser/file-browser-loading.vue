<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useFileBrowserVisibleListColumns } from './composables/use-file-browser-visible-list-columns';
import type { ListReorderableColumnId } from '@/types/user-settings';

const { visibleOptionalListColumns } = useFileBrowserVisibleListColumns();

const columnSkeletonClassMap: Record<ListReorderableColumnId, string> = {
  items: 'file-browser-loading__items',
  size: 'file-browser-loading__size',
  modified: 'file-browser-loading__modified',
  created: 'file-browser-loading__created',
  tags: 'file-browser-loading__tags',
  kind: 'file-browser-loading__kind',
  links: 'file-browser-loading__links',
  linkStatus: 'file-browser-loading__link-status',
};
</script>

<template>
  <ScrollArea class="file-browser-loading">
    <div
      class="file-browser-loading__list"
      data-e2e-root="file-browser-loading"
    >
      <div
        v-for="skeletonIndex in 12"
        :key="skeletonIndex"
        class="file-browser-loading__row"
      >
        <div class="file-browser-loading__name">
          <Skeleton class="file-browser-loading__icon" />
          <Skeleton class="file-browser-loading__text" />
        </div>
        <Skeleton
          v-for="column in visibleOptionalListColumns"
          :key="column.id"
          :class="columnSkeletonClassMap[column.id]"
        />
      </div>
    </div>
  </ScrollArea>
</template>

<style scoped>
.file-browser-loading {
  animation: sigma-ui-fade-in 1s ease-out;
}

.file-browser-loading__list {
  display: flex;
  flex-direction: column;
}

.file-browser-loading__row {
  display: grid;
  width: max-content;
  min-width: 100%;
  padding: var(--file-browser-list-row-padding-y) var(--file-browser-list-row-padding-x);
  padding-right: calc(var(--file-browser-list-row-padding-x) + var(--file-browser-list-columns-button-width));
  column-gap: var(--file-browser-list-column-gap);
  grid-template-columns: var(--file-browser-list-columns);
}

.file-browser-loading__name {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-browser-loading__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 4px;
}

.file-browser-loading__text {
  width: 60%;
  height: 14px;
  border-radius: 4px;
}

.file-browser-loading__kind {
  width: 70px;
  height: 14px;
  border-radius: 4px;
}

.file-browser-loading__links,
.file-browser-loading__items {
  width: 30px;
  height: 14px;
  border-radius: 4px;
}

.file-browser-loading__size {
  width: 50px;
  height: 14px;
  border-radius: 4px;
}

.file-browser-loading__modified,
.file-browser-loading__link-status,
.file-browser-loading__created {
  width: 100px;
  height: 14px;
  border-radius: 4px;
}

.file-browser-loading__tags {
  width: 90px;
  height: 20px;
  border-radius: 4px;
}
</style>
