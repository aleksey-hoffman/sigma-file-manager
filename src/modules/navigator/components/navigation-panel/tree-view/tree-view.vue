<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  provide,
  ref,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useElementSize } from '@vueuse/core';
import TreeViewNode from './tree-view-node.vue';
import { DIRECTORY_TREE_KEY } from './directory-tree-context';
import { useDirectoryTree } from './composables/use-directory-tree';
import { getTreeViewStickyRowLimit, TREE_VIEW_LAYOUT } from './utils/tree-view-sticky';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFileBrowserDrag } from '@/modules/navigator/components/file-browser/composables/use-file-browser-drag';
import { useFileBrowserInternalDropHandler } from '@/modules/navigator/components/file-browser/composables/use-file-browser-internal-drop';
import type { DirEntry } from '@/types/dir-entry';
import { arePathsEquivalent } from '@/utils/file-operation-paths';
import { getParentPath } from '@/utils/normalize-path';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';

const TREE_ROW_SELECTOR = '[role="treeitem"]';
const ACTIVE_TREE_ROW_SELECTOR = '[role="treeitem"][aria-selected="true"]';

const props = defineProps<{
  activePath: string;
  updatesPaused: boolean;
  isViewActive: boolean;
}>();

const emit = defineEmits<{
  navigate: [path: string];
}>();

const { t } = useI18n();
const treeRootRef = ref<HTMLElement | null>(null);
const treeContentRef = ref<HTMLElement | null>(null);
const hasFocusWithin = ref(false);
const dragSelection = ref<DirEntry[]>([]);
const suppressNavigateClick = ref(false);
const internalDropHandler = useFileBrowserInternalDropHandler();
const activePath = computed(() => props.activePath);

const {
  revealVersion,
  isExpanded,
  getChildren,
  setExpanded,
  toggleExpanded,
  refreshDirectory,
} = useDirectoryTree({
  activePath: () => props.activePath,
  areUpdatesPaused: () => props.updatesPaused,
});

const rootChildren = computed(() => getChildren(LOCATIONS_VIRTUAL_PATH));
const { height: treeHeight } = useElementSize(treeRootRef);
const stickyRowLimit = computed(() => getTreeViewStickyRowLimit(treeHeight.value));
const treeLayoutStyle = computed(() => ({
  '--tree-view-row-height': `${TREE_VIEW_LAYOUT.ROW_HEIGHT_PX}px`,
  '--tree-view-sticky-row-limit': stickyRowLimit.value,
}));

const { dragState, handleDragMouseDown } = useFileBrowserDrag({
  selectedEntries: dragSelection,
  currentPath: activePath,
  componentRef: treeRootRef,
  entriesContainerRef: treeRootRef,
  isEntrySelected: entry => dragSelection.value.some(selectedEntry => (
    arePathsEquivalent(selectedEntry.path, entry.path)
  )),
  replaceSelection: (entry) => {
    dragSelection.value = [entry];
  },
  onDrop: async (items, destinationPath, operation) => {
    await internalDropHandler?.(items, destinationPath, operation);
    refreshDirectory(destinationPath);

    if (operation !== 'move') {
      return;
    }

    for (const movedEntry of items) {
      const parentPath = getParentPath(movedEntry.path);

      if (parentPath) {
        refreshDirectory(parentPath);
      }
    }
  },
  disableBackgroundDrop: true,
});

watch(() => dragState.value.isActive, (isActive) => {
  if (isActive) {
    suppressNavigateClick.value = true;
  }
});

function activate(path: string, row: HTMLElement | null) {
  if (suppressNavigateClick.value) {
    suppressNavigateClick.value = false;
    return;
  }

  toggleExpanded(path);
  emit('navigate', path);
  keepTreeRowInView(row).catch((caughtError: unknown) => {
    console.error('Failed to keep directory tree row in view:', caughtError);
  });
}

function clearSuppressedNavigateClick() {
  requestAnimationFrame(() => {
    suppressNavigateClick.value = false;
  });
}

function handleRowMouseDown(entry: DirEntry, event: MouseEvent) {
  if (event.button !== 0) {
    return;
  }

  dragSelection.value = [entry];
  handleDragMouseDown(entry, event);
  window.addEventListener('mouseup', clearSuppressedNavigateClick, { once: true });
}

onBeforeUnmount(() => {
  window.removeEventListener('mouseup', clearSuppressedNavigateClick);
});

provide(DIRECTORY_TREE_KEY, {
  activePath,
  isExpanded,
  getChildren,
  stickyRowLimit,
  activate,
  handleRowMouseDown,
  handleFocusedRowRemoved: () => {
    hasFocusWithin.value = false;
  },
});

function getTreeRows(): HTMLElement[] {
  return [...(treeContentRef.value?.querySelectorAll<HTMLElement>(TREE_ROW_SELECTOR) ?? [])];
}

function getActiveTreeRow(): HTMLElement | null {
  return treeContentRef.value?.querySelector<HTMLElement>(ACTIVE_TREE_ROW_SELECTOR) ?? null;
}

function getParentTreeRow(row: HTMLElement): HTMLElement | null {
  const parentNode = row.closest('[data-tree-node]')?.parentElement?.closest('[data-tree-node]');
  return parentNode?.querySelector<HTMLElement>(TREE_ROW_SELECTOR) ?? null;
}

function handleTreeFocusIn(event: FocusEvent) {
  hasFocusWithin.value = true;

  if (event.target === treeContentRef.value) {
    (getActiveTreeRow() ?? getTreeRows()[0])?.focus();
  }
}

function handleTreeFocusOut(event: FocusEvent) {
  const nextTarget = event.relatedTarget;

  if (nextTarget instanceof Node && treeContentRef.value?.contains(nextTarget)) {
    return;
  }

  hasFocusWithin.value = false;
}

function expandOrEnterRow(row: HTMLElement, rows: HTMLElement[]) {
  const path = row.dataset.treePath;

  if (path && !isExpanded(path)) {
    setExpanded(path, true);
    return;
  }

  const nextRow = rows[rows.indexOf(row) + 1];

  if (nextRow && getParentTreeRow(nextRow) === row) {
    nextRow.focus();
  }
}

function collapseOrLeaveRow(row: HTMLElement) {
  const path = row.dataset.treePath;

  if (path && isExpanded(path)) {
    setExpanded(path, false);
    return;
  }

  getParentTreeRow(row)?.focus();
}

function handleTreeNavigationKey(row: HTMLElement, key: string): boolean {
  const rows = getTreeRows();
  const rowIndex = rows.indexOf(row);
  const isRightToLeft = getComputedStyle(row).direction === 'rtl';
  const expandKey = isRightToLeft ? 'ArrowLeft' : 'ArrowRight';
  const collapseKey = isRightToLeft ? 'ArrowRight' : 'ArrowLeft';

  switch (key) {
    case 'ArrowDown':
      rows[rowIndex + 1]?.focus();
      return true;
    case 'ArrowUp':
      rows[rowIndex - 1]?.focus();
      return true;
    case 'Home':
      rows[0]?.focus();
      return true;
    case 'End':
      rows[rows.length - 1]?.focus();
      return true;
    case expandKey:
      expandOrEnterRow(row, rows);
      return true;
    case collapseKey:
      collapseOrLeaveRow(row);
      return true;
    default:
      return false;
  }
}

function handleTreeKeyDown(event: KeyboardEvent) {
  const row = event.target instanceof HTMLElement
    ? event.target.closest<HTMLElement>(TREE_ROW_SELECTOR)
    : null;

  if (row && handleTreeNavigationKey(row, event.key)) {
    event.preventDefault();
  }
}

function scrollTreeRowIntoView(row: HTMLElement) {
  const viewport = treeRootRef.value?.querySelector<HTMLElement>('.sigma-ui-scroll-area__viewport');

  if (!viewport || !row.isConnected) {
    return;
  }

  const viewportRect = viewport.getBoundingClientRect();

  if (viewportRect.height < 1) {
    return;
  }

  const rowRect = row.getBoundingClientRect();
  const visibleTop = viewportRect.top + (Number.parseFloat(getComputedStyle(row).scrollMarginTop) || 0);

  if (rowRect.top < visibleTop) {
    viewport.scrollTop += rowRect.top - visibleTop;
    return;
  }

  if (rowRect.bottom > viewportRect.bottom) {
    viewport.scrollTop += rowRect.bottom - viewportRect.bottom;
  }
}

async function keepTreeRowInView(row: HTMLElement | null) {
  await nextTick();

  if (row) {
    scrollTreeRowIntoView(row);
  }
}

async function scrollActivePathIntoView() {
  await nextTick();
  const activeRow = getActiveTreeRow();

  if (activeRow) {
    scrollTreeRowIntoView(activeRow);
  }
}

watch([
  revealVersion,
  () => props.updatesPaused,
  () => props.isViewActive,
], () => {
  if (props.updatesPaused || !props.isViewActive) {
    return;
  }

  scrollActivePathIntoView().catch((caughtError: unknown) => {
    console.error('Failed to scroll directory tree:', caughtError);
  });
});
</script>

<template>
  <div
    ref="treeRootRef"
    class="tree-view"
    :style="treeLayoutStyle"
  >
    <ScrollArea class="tree-view__scroll">
      <div
        ref="treeContentRef"
        class="tree-view__content"
        role="tree"
        :aria-label="t('navigator.navigationPanel')"
        :tabindex="hasFocusWithin ? -1 : 0"
        @focusin="handleTreeFocusIn"
        @focusout="handleTreeFocusOut"
        @keydown="handleTreeKeyDown"
      >
        <TreeViewNode
          v-for="rootChild in rootChildren ?? []"
          :key="rootChild.path"
          :entry="rootChild"
          :depth="0"
          disable-drag
        />
        <p
          v-if="rootChildren?.length === 0"
          class="tree-view__empty"
        >
          {{ t('navigator.navigationPanelEmpty') }}
        </p>
      </div>
    </ScrollArea>
  </div>
</template>

<style scoped>
.tree-view {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.tree-view__scroll {
  min-width: 0;
  min-height: 0;
  flex: 1;
}

.tree-view__content {
  padding-block: 6px;
  padding-inline: 6px 1.25rem;
}

.tree-view__content:focus {
  outline: none;
}

.tree-view__empty {
  margin: 4px 8px 0;
  color: hsl(var(--foreground) / 55%);
  font-size: 0.75rem;
}
</style>
