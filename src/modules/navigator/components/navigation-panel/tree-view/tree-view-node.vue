<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRightIcon } from '@lucide/vue';
import { useDirectoryTreeContext } from './directory-tree-context';
import { useProhibitedDragCursor } from './composables/use-prohibited-drag-cursor';
import type { DirectoryTreeEntryRow } from './utils/directory-tree';
import { DirEntryInteractive } from '@/components/dir-entry-interactive';
import { useNavigatorItemIcon } from '@/composables/use-navigator-item-icon';
import { arePathsEquivalent } from '@/utils/file-operation-paths';
import { getPathDisplayName } from '@/utils/normalize-path';
import { isVirtualDirectoryPath } from '@/utils/virtual-locations';

const props = defineProps<{
  row: DirectoryTreeEntryRow;
  rowIndex: number;
}>();

const directoryTree = useDirectoryTreeContext();
const { t } = useI18n();
const rowRef = ref<HTMLElement | null>(null);
const { showProhibitedDragCursor } = useProhibitedDragCursor();

const entry = computed(() => props.row.entry);

const displayName = computed(() => {
  return entry.value.name || getPathDisplayName(entry.value.path, t) || entry.value.path;
});

const isActive = computed(() => {
  return !!directoryTree.activePath.value && arePathsEquivalent(
    entry.value.path,
    directoryTree.activePath.value,
  );
});

const isVirtualDirectory = computed(() => isVirtualDirectoryPath(entry.value.path));
const isDragProhibited = computed(() => props.row.depth === 0 || isVirtualDirectory.value);

const { iconSrc, fallbackIconComponent } = useNavigatorItemIcon({
  path: () => entry.value.path,
  name: () => displayName.value,
  isDir: () => true,
  extension: () => null,
  size: () => 16,
  driveMetadata: () => entry.value.drive_metadata,
});

function activateRow() {
  directoryTree.activate(props.row);
}

function handleRowKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  activateRow();
}

function handleRowMouseDown(event: MouseEvent) {
  if (event.button !== 0) {
    return;
  }

  if (isDragProhibited.value) {
    showProhibitedDragCursor(event);
    return;
  }

  directoryTree.handleRowMouseDown(entry.value, event);
}

onBeforeUnmount(() => {
  if (rowRef.value && rowRef.value === document.activeElement) {
    directoryTree.handleFocusedRowRemoved();
  }
});
</script>

<template>
  <div
    class="tree-view-node"
    :style="{ '--tree-node-depth': row.depth }"
  >
    <span
      class="tree-view-node__indent"
      aria-hidden="true"
    />
    <DirEntryInteractive
      :path="entry.path"
      :is-file="false"
      :disable-drop-target="isVirtualDirectory"
      :is-current-directory-context="isActive"
    >
      <div
        ref="rowRef"
        class="tree-view-node__row"
        :class="{ 'tree-view-node__row--active': isActive }"
        role="treeitem"
        tabindex="-1"
        :aria-selected="isActive"
        :aria-expanded="row.isExpanded"
        :aria-level="row.depth + 1"
        :data-tree-path="entry.path"
        :data-tree-row-index="rowIndex"
        @click="activateRow"
        @keydown="handleRowKeyDown"
        @mousedown="handleRowMouseDown"
      >
        <span
          class="tree-view-node__chevron"
          aria-hidden="true"
          @mousedown.stop
        >
          <ChevronRightIcon
            :size="14"
            class="tree-view-node__chevron-icon"
            :class="{ 'tree-view-node__chevron-icon--expanded': row.isExpanded }"
          />
        </span>
        <img
          v-if="iconSrc"
          :src="iconSrc"
          width="16"
          height="16"
          draggable="false"
          class="tree-view-node__icon"
          alt=""
        >
        <component
          :is="fallbackIconComponent"
          v-else
          :size="16"
          class="tree-view-node__icon"
        />
        <span class="tree-view-node__name">{{ displayName }}</span>
      </div>
    </DirEntryInteractive>
  </div>
</template>

<style scoped>
.tree-view-node {
  display: flex;
  overflow: hidden;
  min-width: 0;
  height: var(--tree-view-row-height);
}

.tree-view-node__indent {
  width: calc(var(--tree-node-depth) * var(--tree-view-indent-width));
  flex: 0 0 auto;
  background-image: var(--tree-view-indent-guides);
}

.tree-view-node :deep(.dir-entry-interactive) {
  min-width: 0;
  flex: 1;
}

.tree-view-node__row {
  display: flex;
  width: 100%;
  min-width: 0;
  height: var(--tree-view-row-height);
  align-items: center;
  padding: 0 8px 0 4px;
  border-radius: var(--radius-sm);
  cursor: default;
  gap: 4px;
  user-select: none;
}

.tree-view-node__row:focus {
  outline: none;
}

.tree-view-node__row:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: -2px;
}

.tree-view-node__row:hover {
  background-color: hsl(var(--foreground) / 5%);
}

.tree-view-node__row--active,
.tree-view-node__row--active:hover {
  background-color: hsl(var(--foreground) / 10%);
}

.tree-view-node__chevron {
  display: flex;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  color: hsl(var(--foreground) / 55%);
}

.tree-view-node__chevron:hover {
  background-color: hsl(var(--foreground) / 8%);
  color: hsl(var(--foreground) / 80%);
}

.tree-view-node__chevron-icon {
  transition: transform 0.15s ease;
}

.tree-view-node__chevron-icon--expanded {
  transform: rotate(90deg);
}

.tree-view-node__icon {
  flex: 0 0 auto;
}

.tree-view-node__name {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<style>
.dir-entry-interactive[data-drag-over] > .tree-view-node__row {
  background-color: var(--drop-target-background);
  outline: var(--drop-target-outline);
  outline-offset: var(--drop-target-outline-offset);
}

html.tree-view-drag-prohibited,
html.tree-view-drag-prohibited * {
  cursor: not-allowed !important;
}
</style>
