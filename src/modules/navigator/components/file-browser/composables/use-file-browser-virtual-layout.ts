// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type ComponentPublicInstance,
  type ComputedRef,
} from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import normalizePath from '@/utils/normalize-path';
import { groupFileBrowserEntries } from '../file-browser-entry-groups';

const LIST_ENTRY_HEIGHT = 42;
const LIST_ENTRY_WITH_DESCRIPTION_HEIGHT = 56;
const GRID_MIN_COLUMN_WIDTH = 170;
const GRID_COLUMN_GAP = 12;
const GRID_ROW_GAP = 12;
const GRID_VIEW_PADDING_X = 8;
const GRID_SECTION_HEADER_HEIGHT = 42;
const GRID_DIR_ENTRY_HEIGHT = 52;
const GRID_ENTRY_HEIGHT = 120;
const VIRTUAL_OVERSCAN_PX = 700;
const SCROLL_TO_PATH_DOM_SYNC_ATTEMPTS = 12;
const STATUS_BAR_BORDER_CLEARANCE = 2;
const SCROLL_VIEWPORT_SELECTOR = '.file-browser__scroll-area-viewport';
const ENTRIES_CONTAINER_SELECTOR = '.file-browser__entries-container';
const FILE_BROWSER_SELECTOR = '.file-browser';
const STATUS_BAR_SELECTOR = '.file-browser-status-bar';
const VIRTUAL_SPACER_SELECTOR = '.file-browser-list-view__list, .file-browser-grid-view__spacer';

export type FileBrowserGridSectionKey = 'dirs' | 'images' | 'videos' | 'others';
export type FileBrowserGridEntryVariant = 'dir' | 'image' | 'video' | 'other';

interface FileBrowserVirtualRowBase {
  key: string;
  start: number;
  size: number;
}

export interface FileBrowserListVirtualRow extends FileBrowserVirtualRowBase {
  type: 'list-entry';
  entry: DirEntry;
  entryIndex: number;
}

export interface FileBrowserGridSectionVirtualRow extends FileBrowserVirtualRowBase {
  type: 'grid-section';
  sectionKey: FileBrowserGridSectionKey;
  variant: FileBrowserGridEntryVariant;
  count: number;
  stickyIndex: number;
}

export interface FileBrowserGridItemsVirtualRow extends FileBrowserVirtualRowBase {
  type: 'grid-items';
  sectionKey: FileBrowserGridSectionKey;
  variant: FileBrowserGridEntryVariant;
  entries: DirEntry[];
  rowIndex: number;
}

export type FileBrowserVirtualRow
  = FileBrowserListVirtualRow
    | FileBrowserGridSectionVirtualRow
    | FileBrowserGridItemsVirtualRow;

interface GridSectionDefinition {
  key: FileBrowserGridSectionKey;
  variant: FileBrowserGridEntryVariant;
  entries: DirEntry[];
  stickyIndex: number;
  entryHeight: number;
}

function resolveScrollViewportElement(element: HTMLElement): HTMLElement {
  if (element.matches(SCROLL_VIEWPORT_SELECTOR)) {
    return element;
  }

  const closestViewport = element.closest<HTMLElement>(SCROLL_VIEWPORT_SELECTOR);

  if (closestViewport) {
    return closestViewport;
  }

  return element.querySelector<HTMLElement>(SCROLL_VIEWPORT_SELECTOR) ?? element;
}

function resolveElement(element: Element | ComponentPublicInstance | null): HTMLElement | null {
  const rawElement = element instanceof HTMLElement
    ? element
    : element && '$el' in element && element.$el instanceof HTMLElement
      ? element.$el
      : null;

  return rawElement ? resolveScrollViewportElement(rawElement) : null;
}

function getRowEnd(row: FileBrowserVirtualRow): number {
  return row.start + row.size;
}

function getRowScrollMarginTop(row: FileBrowserVirtualRow, virtualContentOffset: number): number {
  if (row.type === 'list-entry') {
    return virtualContentOffset;
  }

  return row.type === 'grid-items' ? GRID_SECTION_HEADER_HEIGHT + GRID_ROW_GAP : 0;
}

function getStatusBarOverlap(viewport: HTMLElement, statusBar: HTMLElement | null | undefined): number {
  if (!statusBar) {
    return 0;
  }

  const viewportRect = viewport.getBoundingClientRect();
  const statusBarRect = statusBar.getBoundingClientRect();
  const overlap = Math.max(0, viewportRect.bottom - statusBarRect.top);

  return overlap > 0 ? overlap + STATUS_BAR_BORDER_CLEARANCE : 0;
}

function getVirtualContentOffset(viewport: HTMLElement): number {
  const virtualSpacer = viewport.querySelector<HTMLElement>(VIRTUAL_SPACER_SELECTOR);

  if (!virtualSpacer) {
    return 0;
  }

  return Math.max(0, virtualSpacer.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop);
}

function findFirstVisibleRowIndex(rows: readonly FileBrowserVirtualRow[], viewportStart: number): number {
  let startIndex = 0;
  let endIndex = rows.length - 1;
  let resultIndex = rows.length;

  while (startIndex <= endIndex) {
    const middleIndex = Math.floor((startIndex + endIndex) / 2);

    if (getRowEnd(rows[middleIndex]) >= viewportStart) {
      resultIndex = middleIndex;
      endIndex = middleIndex - 1;
    }
    else {
      startIndex = middleIndex + 1;
    }
  }

  return resultIndex;
}

function findVisibleRowEndIndex(rows: readonly FileBrowserVirtualRow[], viewportEnd: number): number {
  let startIndex = 0;
  let endIndex = rows.length;

  while (startIndex < endIndex) {
    const middleIndex = Math.floor((startIndex + endIndex) / 2);

    if (rows[middleIndex].start <= viewportEnd) {
      startIndex = middleIndex + 1;
    }
    else {
      endIndex = middleIndex;
    }
  }

  return startIndex;
}

function escapeCssAttribute(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

function getEntryDescriptionHeight(
  entry: DirEntry,
  entryDescription?: (entry: DirEntry) => string | undefined,
): number {
  return entryDescription?.(entry) ? LIST_ENTRY_WITH_DESCRIPTION_HEIGHT : LIST_ENTRY_HEIGHT;
}

function getGridColumnCount(viewportWidth: number): number {
  const availableWidth = Math.max(0, viewportWidth - GRID_VIEW_PADDING_X);
  return Math.max(1, Math.floor((availableWidth + GRID_COLUMN_GAP) / (GRID_MIN_COLUMN_WIDTH + GRID_COLUMN_GAP)));
}

function createListRows(
  entries: readonly DirEntry[],
  entryDescription?: (entry: DirEntry) => string | undefined,
): FileBrowserVirtualRow[] {
  let offset = 0;

  return entries.map((entry, entryIndex) => {
    const size = getEntryDescriptionHeight(entry, entryDescription);
    const row: FileBrowserListVirtualRow = {
      type: 'list-entry',
      key: `list:${entry.path}`,
      entry,
      entryIndex,
      start: offset,
      size,
    };

    offset += size;
    return row;
  });
}

function createGridSectionRows(
  section: GridSectionDefinition,
  columnCount: number,
  offset: number,
): {
  rows: FileBrowserVirtualRow[];
  offset: number;
} {
  if (section.entries.length === 0) {
    return {
      rows: [],
      offset,
    };
  }

  const rows: FileBrowserVirtualRow[] = [
    {
      type: 'grid-section',
      key: `grid-section:${section.key}`,
      sectionKey: section.key,
      variant: section.variant,
      count: section.entries.length,
      stickyIndex: section.stickyIndex,
      start: offset,
      size: GRID_SECTION_HEADER_HEIGHT + GRID_ROW_GAP,
    },
  ];

  offset += GRID_SECTION_HEADER_HEIGHT + GRID_ROW_GAP;

  for (let entryIndex = 0, rowIndex = 0; entryIndex < section.entries.length; entryIndex += columnCount, rowIndex += 1) {
    const rowEntries = section.entries.slice(entryIndex, entryIndex + columnCount);

    rows.push({
      type: 'grid-items',
      key: `grid-items:${section.key}:${rowIndex}:${rowEntries.map(entry => entry.path).join('|')}`,
      sectionKey: section.key,
      variant: section.variant,
      entries: rowEntries,
      rowIndex,
      start: offset,
      size: section.entryHeight + GRID_ROW_GAP,
    });

    offset += section.entryHeight + GRID_ROW_GAP;
  }

  return {
    rows,
    offset,
  };
}

function createGridRows(entries: readonly DirEntry[], columnCount: number): FileBrowserVirtualRow[] {
  const groupedEntries = groupFileBrowserEntries(entries);
  const sections: GridSectionDefinition[] = [
    {
      key: 'dirs',
      variant: 'dir',
      entries: groupedEntries.dirs,
      stickyIndex: 10,
      entryHeight: GRID_DIR_ENTRY_HEIGHT,
    },
    {
      key: 'images',
      variant: 'image',
      entries: groupedEntries.images,
      stickyIndex: 11,
      entryHeight: GRID_ENTRY_HEIGHT,
    },
    {
      key: 'videos',
      variant: 'video',
      entries: groupedEntries.videos,
      stickyIndex: 12,
      entryHeight: GRID_ENTRY_HEIGHT,
    },
    {
      key: 'others',
      variant: 'other',
      entries: groupedEntries.others,
      stickyIndex: 13,
      entryHeight: GRID_ENTRY_HEIGHT,
    },
  ];

  let offset = 0;
  const rows: FileBrowserVirtualRow[] = [];

  for (const section of sections) {
    const result = createGridSectionRows(section, columnCount, offset);
    rows.push(...result.rows);
    offset = result.offset;
  }

  return rows;
}

export function createFileBrowserVirtualRows(options: {
  entries: readonly DirEntry[];
  layout: 'list' | 'grid' | undefined;
  viewportWidth: number;
  entryDescription?: (entry: DirEntry) => string | undefined;
}): FileBrowserVirtualRow[] {
  if (options.layout === 'grid') {
    return createGridRows(options.entries, getGridColumnCount(options.viewportWidth));
  }

  return createListRows(options.entries, options.entryDescription);
}

export function getFileBrowserGridNavigationEntry(
  rows: readonly FileBrowserVirtualRow[],
  path: string,
  direction: 'up' | 'down',
): DirEntry | null {
  const currentRow = rows.find((row): row is FileBrowserGridItemsVirtualRow => {
    return row.type === 'grid-items' && row.entries.some(entry => entry.path === path);
  });

  if (!currentRow) {
    return null;
  }

  const currentColumnIndex = currentRow.entries.findIndex(entry => entry.path === path);
  const gridRows = rows.filter((row): row is FileBrowserGridItemsVirtualRow => row.type === 'grid-items');
  const currentGridRowIndex = gridRows.findIndex(row => row === currentRow);
  const targetGridRowIndex = direction === 'down' ? currentGridRowIndex + 1 : currentGridRowIndex - 1;
  const targetRow = gridRows[targetGridRowIndex];

  if (!targetRow) {
    return null;
  }

  return targetRow.entries[Math.min(currentColumnIndex, targetRow.entries.length - 1)] ?? null;
}

export function useFileBrowserVirtualLayout(options: {
  entries: ComputedRef<DirEntry[]>;
  layout: () => 'list' | 'grid' | undefined;
  entryDescription?: (entry: DirEntry) => string | undefined;
}) {
  const scrollViewportRef = ref<HTMLElement | null>(null);
  const viewportHeight = ref(0);
  const viewportWidth = ref(0);
  const bottomScrollMargin = ref(0);
  const scrollTop = ref(0);
  const virtualContentOffset = ref(0);
  let viewportResizeObserver: ResizeObserver | null = null;

  const gridColumnCount = computed(() => getGridColumnCount(viewportWidth.value));

  const rows = computed<FileBrowserVirtualRow[]>(() => {
    return createFileBrowserVirtualRows({
      entries: options.entries.value,
      layout: options.layout(),
      viewportWidth: viewportWidth.value,
      entryDescription: options.entryDescription,
    });
  });

  const totalSize = computed(() => {
    const lastRow = rows.value[rows.value.length - 1];
    return (lastRow ? getRowEnd(lastRow) : 0) + bottomScrollMargin.value;
  });

  const visibleRows = computed(() => {
    const virtualScrollTop = Math.max(0, scrollTop.value - virtualContentOffset.value);
    const viewportStart = Math.max(0, virtualScrollTop - VIRTUAL_OVERSCAN_PX);
    const viewportEnd = virtualScrollTop + viewportHeight.value + VIRTUAL_OVERSCAN_PX;
    const rowItems = rows.value;
    const startIndex = findFirstVisibleRowIndex(rowItems, viewportStart);
    const endIndex = findVisibleRowEndIndex(rowItems, viewportEnd);

    return rowItems.slice(startIndex, endIndex);
  });

  const activeGridSectionRow = computed(() => {
    if (options.layout() !== 'grid') {
      return null;
    }

    let activeRow: FileBrowserGridSectionVirtualRow | null = null;
    const virtualScrollTop = Math.max(0, scrollTop.value - virtualContentOffset.value);

    for (const row of rows.value) {
      if (row.start > virtualScrollTop) {
        break;
      }

      if (row.type === 'grid-section') {
        activeRow = row;
      }
    }

    return activeRow;
  });

  const offsetY = computed(() => visibleRows.value[0]?.start ?? 0);

  const spacerStyle = computed(() => ({
    height: `${totalSize.value}px`,
  }));

  const windowStyle = computed(() => ({
    transform: `translateY(${offsetY.value}px)`,
  }));

  function updateViewportSize() {
    const viewport = scrollViewportRef.value;

    if (!viewport) {
      viewportHeight.value = 0;
      viewportWidth.value = 0;
      virtualContentOffset.value = 0;
      scrollTop.value = 0;
      return;
    }

    const entriesContainer = viewport.querySelector<HTMLElement>(ENTRIES_CONTAINER_SELECTOR);
    const fileBrowser = viewport.closest<HTMLElement>(FILE_BROWSER_SELECTOR);
    const statusBar = fileBrowser?.querySelector<HTMLElement>(STATUS_BAR_SELECTOR);

    viewportHeight.value = viewport.clientHeight;
    viewportWidth.value = entriesContainer?.clientWidth ?? viewport.clientWidth;
    virtualContentOffset.value = getVirtualContentOffset(viewport);
    bottomScrollMargin.value = getStatusBarOverlap(viewport, statusBar);
    scrollTop.value = Math.max(0, viewport.scrollTop);
  }

  function disconnectViewportResizeObserver() {
    viewportResizeObserver?.disconnect();
    viewportResizeObserver = null;
  }

  function observeViewportSize() {
    disconnectViewportResizeObserver();

    const viewport = scrollViewportRef.value;

    if (!viewport || typeof ResizeObserver === 'undefined') {
      updateViewportSize();
      return;
    }

    viewportResizeObserver = new ResizeObserver(updateViewportSize);
    viewportResizeObserver.observe(viewport);
    updateViewportSize();
  }

  function setScrollViewportRef(element: Element | ComponentPublicInstance | null) {
    const viewport = resolveElement(element);

    if (scrollViewportRef.value === viewport) {
      return;
    }

    scrollViewportRef.value = viewport;
    observeViewportSize();
  }

  function handleScroll(event: Event) {
    const target = event.currentTarget;

    if (target instanceof HTMLElement) {
      const viewport = resolveScrollViewportElement(target);

      if (scrollViewportRef.value !== viewport) {
        scrollViewportRef.value = viewport;
        observeViewportSize();
      }

      scrollTop.value = Math.max(0, viewport.scrollTop);
    }
  }

  function entryPathsMatch(left: string, right: string): boolean {
    return normalizePath(left) === normalizePath(right);
  }

  function getEntryElement(path: string): HTMLElement | null {
    const viewport = scrollViewportRef.value;

    if (!viewport) {
      return null;
    }

    const normalizedPath = normalizePath(path);
    const candidates = path === normalizedPath ? [path] : [normalizedPath, path];

    for (const candidate of [...new Set(candidates)]) {
      const match = viewport.querySelector<HTMLElement>(
        `[data-entry-path="${escapeCssAttribute(candidate)}"]`,
      );

      if (match) {
        return match;
      }
    }

    return null;
  }

  async function ensureEntryElementInView(
    path: string,
    row: FileBrowserVirtualRow,
    align: ScrollLogicalPosition,
  ) {
    await nextTick();

    const viewport = scrollViewportRef.value;
    const entryElement = getEntryElement(path);

    if (!viewport || !entryElement) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const entryRect = entryElement.getBoundingClientRect();
    const minVisibleTop = viewportRect.top + getRowScrollMarginTop(row, virtualContentOffset.value);
    const maxVisibleBottom = viewportRect.bottom - bottomScrollMargin.value;
    let scrollAdjustment = 0;

    if (align === 'center') {
      const viewportCenter = minVisibleTop + (maxVisibleBottom - minVisibleTop) / 2;
      const entryCenter = entryRect.top + entryRect.height / 2;
      scrollAdjustment = entryCenter - viewportCenter;
    }
    else if (align === 'start') {
      scrollAdjustment = entryRect.top - minVisibleTop;
    }
    else if (align === 'end') {
      scrollAdjustment = entryRect.bottom - maxVisibleBottom;
    }
    else if (entryRect.top < minVisibleTop) {
      scrollAdjustment = entryRect.top - minVisibleTop;
    }
    else if (entryRect.bottom > maxVisibleBottom) {
      scrollAdjustment = entryRect.bottom - maxVisibleBottom;
    }

    if (scrollAdjustment !== 0) {
      setScrollTop(scrollTop.value + scrollAdjustment);
      await nextTick();
    }
  }

  function findRowByPath(path: string): FileBrowserVirtualRow | null {
    return rows.value.find((row) => {
      if (row.type === 'list-entry') {
        return entryPathsMatch(row.entry.path, path);
      }

      if (row.type === 'grid-items') {
        return row.entries.some(entry => entryPathsMatch(entry.path, path));
      }

      return false;
    }) ?? null;
  }

  function getMaxScrollTop() {
    const viewport = scrollViewportRef.value;
    const virtualMaxScrollTop = Math.max(0, virtualContentOffset.value + totalSize.value - viewportHeight.value);
    const browserMaxScrollTop = viewport ? Math.max(0, viewport.scrollHeight - viewport.clientHeight) : 0;

    return Math.max(virtualMaxScrollTop, browserMaxScrollTop);
  }

  function setScrollTop(nextScrollTop: number) {
    const viewport = scrollViewportRef.value;

    if (!viewport) {
      return;
    }

    const maxScrollTop = getMaxScrollTop();
    const normalizedScrollTop = Math.min(Math.max(0, nextScrollTop), maxScrollTop);
    viewport.scrollTop = normalizedScrollTop;
    scrollTop.value = normalizedScrollTop;
  }

  async function scrollToRow(row: FileBrowserVirtualRow, align: ScrollLogicalPosition = 'nearest') {
    const currentViewportHeight = viewportHeight.value;
    const currentScrollTop = scrollTop.value;
    const rowStart = virtualContentOffset.value + row.start;
    const rowEnd = virtualContentOffset.value + getRowEnd(row);
    const scrollMarginTop = getRowScrollMarginTop(row, virtualContentOffset.value);
    const scrollMarginBottom = bottomScrollMargin.value;

    if (align === 'center') {
      setScrollTop(rowStart - (currentViewportHeight - row.size) / 2);
    }
    else if (align === 'end') {
      setScrollTop(rowEnd - currentViewportHeight + scrollMarginBottom);
    }
    else if (align === 'start') {
      setScrollTop(rowStart - scrollMarginTop);
    }
    else if (rowStart < currentScrollTop + scrollMarginTop) {
      setScrollTop(rowStart - scrollMarginTop);
    }
    else if (rowEnd > currentScrollTop + currentViewportHeight - scrollMarginBottom) {
      setScrollTop(rowEnd - currentViewportHeight + scrollMarginBottom);
    }

    await nextTick();
  }

  async function scrollToPath(path: string, align: ScrollLogicalPosition = 'nearest'): Promise<boolean> {
    const row = findRowByPath(path);

    if (!row) {
      return false;
    }

    for (let attemptIndex = 0; attemptIndex < SCROLL_TO_PATH_DOM_SYNC_ATTEMPTS; attemptIndex += 1) {
      await scrollToRow(row, align);
      await nextTick();
      await new Promise<void>((resolveFrame) => {
        requestAnimationFrame(() => resolveFrame());
      });

      const entryElement = getEntryElement(path);

      if (entryElement) {
        await ensureEntryElementInView(path, row, align);
        return true;
      }
    }

    return false;
  }

  async function scrollToIndex(index: number, align: ScrollLogicalPosition = 'nearest'): Promise<boolean> {
    const entry = options.entries.value[index];

    if (!entry) {
      return false;
    }

    return scrollToPath(entry.path, align);
  }

  function getGridNavigationEntry(path: string, direction: 'up' | 'down'): DirEntry | null {
    return getFileBrowserGridNavigationEntry(rows.value, path, direction);
  }

  watch(rows, () => {
    const viewport = scrollViewportRef.value;

    if (!viewport) {
      return;
    }

    if (scrollTop.value > getMaxScrollTop()) {
      setScrollTop(getMaxScrollTop());
    }
  });

  watch(options.entries, () => {
    nextTick(updateViewportSize);
  });

  watch(() => options.layout(), () => {
    nextTick(updateViewportSize);
  });

  onBeforeUnmount(() => {
    disconnectViewportResizeObserver();
  });

  return {
    scrollViewportRef,
    viewportHeight,
    viewportWidth,
    scrollTop,
    gridColumnCount,
    rows,
    visibleRows,
    activeGridSectionRow,
    totalSize,
    offsetY,
    spacerStyle,
    windowStyle,
    setScrollViewportRef,
    handleScroll,
    getEntryElement,
    scrollToPath,
    scrollToIndex,
    getGridNavigationEntry,
  };
}
