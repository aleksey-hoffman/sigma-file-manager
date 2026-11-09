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
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaViewport,
} from 'reka-ui';
import TreeViewNode from './tree-view-node.vue';
import { DIRECTORY_TREE_KEY } from './directory-tree-context';
import { useDirectoryTree } from './composables/use-directory-tree';
import {
  flattenDirectoryTree,
  type DirectoryTreeEntryRow,
} from './utils/directory-tree';
import {
  getTreeViewStickyRowLimit,
  getTreeViewStickyRows,
  TREE_VIEW_LAYOUT,
} from './utils/tree-view-sticky';
import { ScrollBar } from '@/components/ui/scroll-area';
import { useVerticalVirtualList } from '@/composables/use-vertical-virtual-list';
import { useFileBrowserDrag } from '@/modules/navigator/components/file-browser/composables/use-file-browser-drag';
import { useFileBrowserInternalDropHandler } from '@/modules/navigator/components/file-browser/composables/use-file-browser-internal-drop';
import type { DirEntry } from '@/types/dir-entry';
import { arePathsEquivalent } from '@/utils/file-operation-paths';
import { getParentPath } from '@/utils/normalize-path';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';

const TREE_INDENT_WIDTH_PX = 20;
const TREE_GUIDE_OFFSET_PX = 11;

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
const treeRows = computed(() => flattenDirectoryTree(rootChildren.value ?? [], isExpanded, getChildren));
const treeVirtualList = useVerticalVirtualList({
  items: treeRows,
  getItemSize: () => TREE_VIEW_LAYOUT.ROW_HEIGHT_PX,
  paddingStartPx: TREE_VIEW_LAYOUT.CONTENT_PADDING_BLOCK_PX,
  paddingEndPx: TREE_VIEW_LAYOUT.CONTENT_PADDING_BLOCK_PX,
});
const {
  scrollTop: treeScrollTop,
  viewportHeight: treeViewportHeight,
  visibleItems: visibleTreeRows,
  spacerStyle: treeSpacerStyle,
  windowStyle: treeWindowStyle,
  scrollViewportRef: treeViewportRef,
} = treeVirtualList;
const stickyRowLimit = computed(() => getTreeViewStickyRowLimit(treeViewportHeight.value));
const stickyRows = computed(() => getTreeViewStickyRows({
  rows: treeRows.value,
  rowsScrollTopPx: treeScrollTop.value - TREE_VIEW_LAYOUT.CONTENT_PADDING_BLOCK_PX,
  rowHeightPx: TREE_VIEW_LAYOUT.ROW_HEIGHT_PX,
  limit: stickyRowLimit.value,
}).flatMap((stickyRow) => {
  const row = treeRows.value[stickyRow.index];
  return row.kind === 'entry'
    ? [{
        ...stickyRow,
        row,
      }]
    : [];
}));
const stickyRowIndexes = computed(() => new Set(stickyRows.value.map(stickyRow => stickyRow.index)));
const treeLayoutStyle = computed(() => ({
  '--tree-view-row-height': `${TREE_VIEW_LAYOUT.ROW_HEIGHT_PX}px`,
  '--tree-view-indent-width': `${TREE_INDENT_WIDTH_PX}px`,
  '--tree-view-guide-offset': `${TREE_GUIDE_OFFSET_PX}px`,
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

function getRowIndexByKey(key: string): number {
  return treeRows.value.findIndex(row => row.key === key);
}

function activate(row: DirectoryTreeEntryRow) {
  if (suppressNavigateClick.value) {
    suppressNavigateClick.value = false;
    return;
  }

  toggleExpanded(row.entry.path);
  emit('navigate', row.entry.path);
  keepRowInView(row.key).catch((caughtError: unknown) => {
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
  activate,
  handleRowMouseDown,
  handleFocusedRowRemoved: () => {
    hasFocusWithin.value = false;
  },
});

function setTreeScrollTop(scrollTopPx: number) {
  const viewport = treeViewportRef.value;

  if (!viewport) {
    return;
  }

  viewport.scrollTop = Math.max(0, scrollTopPx);
  treeScrollTop.value = viewport.scrollTop;
}

function scrollRowIntoView(index: number) {
  const row = treeRows.value[index];
  const viewportHeight = treeViewportRef.value?.clientHeight ?? 0;

  if (!row || viewportHeight < 1) {
    return;
  }

  const rowTopPx = TREE_VIEW_LAYOUT.CONTENT_PADDING_BLOCK_PX + index * TREE_VIEW_LAYOUT.ROW_HEIGHT_PX;
  const rowBottomPx = rowTopPx + TREE_VIEW_LAYOUT.ROW_HEIGHT_PX;
  const stickyHeightPx = Math.min(row.depth, stickyRowLimit.value) * TREE_VIEW_LAYOUT.ROW_HEIGHT_PX;
  const visibleTopPx = treeScrollTop.value + stickyHeightPx;

  if (rowTopPx < visibleTopPx) {
    setTreeScrollTop(rowTopPx - stickyHeightPx);
    return;
  }

  if (rowBottomPx > treeScrollTop.value + viewportHeight) {
    setTreeScrollTop(rowBottomPx - viewportHeight);
  }
}

function getRowElement(index: number): HTMLElement | null {
  return treeContentRef.value?.querySelector<HTMLElement>(`[role="treeitem"][data-tree-row-index="${index}"]`) ?? null;
}

async function focusRow(index: number) {
  if (treeRows.value[index]?.kind !== 'entry') {
    return;
  }

  scrollRowIntoView(index);
  await nextTick();
  getRowElement(index)?.focus();
}

function findEntryRowIndex(startIndex: number, step: 1 | -1): number {
  for (let index = startIndex; index >= 0 && index < treeRows.value.length; index += step) {
    if (treeRows.value[index].kind === 'entry') {
      return index;
    }
  }

  return -1;
}

function findActiveRowIndex(): number {
  if (!props.activePath) {
    return -1;
  }

  return treeRows.value.findIndex(row => (
    row.kind === 'entry' && arePathsEquivalent(row.entry.path, props.activePath)
  ));
}

async function keepRowInView(key: string) {
  await nextTick();
  const index = getRowIndexByKey(key);

  if (index >= 0) {
    scrollRowIntoView(index);
  }
}

function getFocusedRowIndex(target: EventTarget | null): number {
  const rowElement = target instanceof HTMLElement
    ? target.closest<HTMLElement>('[role="treeitem"]')
    : null;
  const index = Number(rowElement?.dataset.treeRowIndex);

  return Number.isInteger(index) && treeRows.value[index]?.kind === 'entry' ? index : -1;
}

function handleTreeFocusIn(event: FocusEvent) {
  hasFocusWithin.value = true;

  if (event.target !== treeContentRef.value) {
    return;
  }

  const activeIndex = findActiveRowIndex();
  focusRow(activeIndex >= 0 ? activeIndex : findEntryRowIndex(0, 1)).catch((caughtError: unknown) => {
    console.error('Failed to focus directory tree row:', caughtError);
  });
}

function handleTreeFocusOut(event: FocusEvent) {
  const nextTarget = event.relatedTarget;

  if (nextTarget instanceof Node && treeContentRef.value?.contains(nextTarget)) {
    return;
  }

  hasFocusWithin.value = false;
}

function expandOrEnterRow(row: DirectoryTreeEntryRow, index: number): number {
  if (!row.isExpanded) {
    setExpanded(row.entry.path, true);
    return -1;
  }

  const nextRow = treeRows.value[index + 1];
  return nextRow?.kind === 'entry' && nextRow.parentIndex === index ? index + 1 : -1;
}

function collapseOrLeaveRow(row: DirectoryTreeEntryRow): number {
  if (row.isExpanded) {
    setExpanded(row.entry.path, false);
    return -1;
  }

  return row.parentIndex;
}

function getNavigationTargetIndex(index: number, key: string, isRightToLeft: boolean): number | null {
  const row = treeRows.value[index];
  const expandKey = isRightToLeft ? 'ArrowLeft' : 'ArrowRight';
  const collapseKey = isRightToLeft ? 'ArrowRight' : 'ArrowLeft';

  if (row.kind !== 'entry') {
    return null;
  }

  switch (key) {
    case 'ArrowDown':
      return findEntryRowIndex(index + 1, 1);
    case 'ArrowUp':
      return findEntryRowIndex(index - 1, -1);
    case 'Home':
      return findEntryRowIndex(0, 1);
    case 'End':
      return findEntryRowIndex(treeRows.value.length - 1, -1);
    case expandKey:
      return expandOrEnterRow(row, index);
    case collapseKey:
      return collapseOrLeaveRow(row);
    default:
      return null;
  }
}

function handleTreeKeyDown(event: KeyboardEvent) {
  const index = getFocusedRowIndex(event.target);

  if (index < 0 || !(event.target instanceof HTMLElement)) {
    return;
  }

  const isRightToLeft = getComputedStyle(event.target).direction === 'rtl';
  const targetIndex = getNavigationTargetIndex(index, event.key, isRightToLeft);

  if (targetIndex === null) {
    return;
  }

  event.preventDefault();

  if (targetIndex >= 0) {
    focusRow(targetIndex).catch((caughtError: unknown) => {
      console.error('Failed to focus directory tree row:', caughtError);
    });
  }
}

async function scrollActivePathIntoView() {
  await nextTick();
  const activeIndex = findActiveRowIndex();

  if (activeIndex >= 0) {
    scrollRowIntoView(activeIndex);
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
    <ScrollAreaRoot class="sigma-ui-scroll-area tree-view__scroll">
      <ScrollAreaViewport
        :ref="treeVirtualList.setScrollViewportRef"
        class="sigma-ui-scroll-area__viewport"
        @scroll.passive="treeVirtualList.handleScroll"
      >
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
          <div class="tree-view__sticky-layer">
            <div
              v-for="stickyRow in stickyRows"
              :key="stickyRow.row.key"
              class="tree-view__sticky-row"
              :style="{
                top: `${stickyRow.topPx}px`,
                zIndex: stickyRowLimit - stickyRow.row.depth,
              }"
            >
              <TreeViewNode
                :row="stickyRow.row"
                :row-index="stickyRow.index"
              />
            </div>
          </div>
          <div
            class="tree-view__spacer"
            :style="treeSpacerStyle"
          >
            <div
              class="tree-view__window"
              :style="treeWindowStyle"
            >
              <template
                v-for="virtualRow in visibleTreeRows"
                :key="virtualRow.item.key"
              >
                <div
                  v-if="stickyRowIndexes.has(virtualRow.index)"
                  class="tree-view__row-placeholder"
                />
                <p
                  v-else-if="virtualRow.item.kind === 'empty'"
                  class="tree-view__empty-row"
                  :style="{ '--tree-node-depth': virtualRow.item.depth }"
                >
                  {{ t('navigator.navigationPanelNoNestedDirs') }}
                </p>
                <TreeViewNode
                  v-else
                  :row="virtualRow.item"
                  :row-index="virtualRow.index"
                />
              </template>
            </div>
          </div>
          <p
            v-if="rootChildren?.length === 0"
            class="tree-view__empty"
          >
            {{ t('navigator.navigationPanelEmpty') }}
          </p>
        </div>
      </ScrollAreaViewport>
      <ScrollBar orientation="vertical" />
      <ScrollAreaCorner />
    </ScrollAreaRoot>
  </div>
</template>

<style scoped>
.tree-view {
  --tree-view-indent-guides: repeating-linear-gradient(
    to right,
    transparent 0 var(--tree-view-guide-offset),
    hsl(var(--foreground) / 10%) var(--tree-view-guide-offset) calc(var(--tree-view-guide-offset) + 1px),
    transparent calc(var(--tree-view-guide-offset) + 1px) var(--tree-view-indent-width)
  );

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
  position: relative;
  padding-inline: 6px 1.25rem;
}

.tree-view__content:focus {
  outline: none;
}

.tree-view__sticky-layer {
  position: sticky;
  z-index: 1;
  top: 0;
  height: 0;
}

.tree-view__sticky-row {
  position: absolute;
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--background-3));
  inset-inline: 0;
}

.tree-view__spacer {
  position: relative;
}

.tree-view__window {
  position: absolute;
  top: 0;
  inset-inline: 0;
}

.tree-view__row-placeholder {
  height: var(--tree-view-row-height);
}

.tree-view__empty-row {
  overflow: hidden;
  min-width: 0;
  height: var(--tree-view-row-height);
  margin: 0;
  background-image: var(--tree-view-indent-guides);
  background-repeat: no-repeat;
  background-size: calc(var(--tree-node-depth) * var(--tree-view-indent-width)) 100%;
  color: hsl(var(--foreground) / 55%);
  font-size: 0.75rem;
  line-height: var(--tree-view-row-height);
  padding-block: 0;
  padding-inline: calc(var(--tree-node-depth) * var(--tree-view-indent-width) + 24px) 8px;
  text-overflow: ellipsis;
  user-select: none;
  white-space: nowrap;
}

.tree-view__empty {
  margin: 4px 8px 0;
  color: hsl(var(--foreground) / 55%);
  font-size: 0.75rem;
}
</style>
