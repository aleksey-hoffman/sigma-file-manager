// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  inject,
  nextTick,
  provide,
  ref,
  watch,
  type ComponentPublicInstance,
  type InjectionKey,
  type Ref,
} from 'vue';
import { useDebounceFn } from '@vueuse/core';
import type { ListColumnFlexWeights, ListColumnWidths } from '@/types/user-settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  buildListColumnsGridTemplate,
  clampListColumnWidth,
  convertWidthsToFlexWeights,
  getListColumnDefinition,
  getVisibleListColumnDefinitions,
  measureHeaderColumnWidths,
  redistributeListColumnWidths,
  type FileBrowserListColumnId,
} from '../utils/file-browser-list-columns';
import {
  refreshScrollAreaHorizontalMetrics,
  resolveScrollAreaViewportElement,
} from '../utils/refresh-scroll-area-horizontal';

export interface FileBrowserListColumnsContext {
  listColumnsTemplate: Ref<string>;
  activeResizeColumnId: Ref<FileBrowserListColumnId | null>;
  resizePreviewWidths: Ref<ListColumnWidths>;
  setMeasuredColumnWidths: (columnWidths: ListColumnWidths) => void;
  setHeaderGridElement: (headerGridElement: HTMLElement | null) => void;
  setScrollViewportElement: (scrollViewportElement: Element | ComponentPublicInstance | null) => void;
  beginColumnResize: (
    columnId: FileBrowserListColumnId,
    startWidth: number,
  ) => void;
  updateColumnResize: (columnId: FileBrowserListColumnId, width: number) => void;
  finishColumnResize: (columnId: FileBrowserListColumnId) => Promise<void>;
  cancelColumnResize: () => void;
}

const FILE_BROWSER_LIST_COLUMNS_KEY: InjectionKey<FileBrowserListColumnsContext> = Symbol('fileBrowserListColumns');

export function provideFileBrowserListColumns(): FileBrowserListColumnsContext {
  const userSettingsStore = useUserSettingsStore();
  const activeResizeColumnId = ref<FileBrowserListColumnId | null>(null);
  const resizePreviewWidths = ref<ListColumnWidths>({});
  const resizePreviewFlexWeights = ref<ListColumnFlexWeights>({});
  const resizeStartWidths = ref<ListColumnWidths>({});
  const measuredColumnWidths = ref<ListColumnWidths>({});
  const headerGridElementRef = ref<HTMLElement | null>(null);
  const scrollViewportElementRef = ref<HTMLElement | null>(null);

  const columnVisibility = computed(() => userSettingsStore.userSettings.navigator.listColumnVisibility);
  const listColumnFillWidth = computed(() => userSettingsStore.userSettings.navigator.listColumnFillWidth);
  const listColumnOrder = computed(() => userSettingsStore.userSettings.navigator.listColumnOrder);

  function areColumnWidthsEqual(left: ListColumnWidths, right: ListColumnWidths) {
    const leftEntries = Object.entries(left);
    const rightEntries = Object.entries(right);

    if (leftEntries.length !== rightEntries.length) {
      return false;
    }

    return leftEntries.every(([columnId, width]) => {
      return right[columnId as keyof ListColumnWidths] === width;
    });
  }

  function setMeasuredColumnWidths(columnWidths: ListColumnWidths) {
    if (areColumnWidthsEqual(measuredColumnWidths.value, columnWidths)) {
      return;
    }

    measuredColumnWidths.value = columnWidths;
  }

  function setHeaderGridElement(headerGridElement: HTMLElement | null) {
    headerGridElementRef.value = headerGridElement;
  }

  function setScrollViewportElement(scrollViewportElement: Element | ComponentPublicInstance | null) {
    const rawElement = scrollViewportElement instanceof HTMLElement
      ? scrollViewportElement
      : scrollViewportElement && '$el' in scrollViewportElement && scrollViewportElement.$el instanceof HTMLElement
        ? scrollViewportElement.$el
        : null;

    scrollViewportElementRef.value = rawElement
      ? resolveScrollAreaViewportElement(rawElement)
      : null;
  }

  const refreshHorizontalScrollArea = useDebounceFn(() => {
    if (!scrollViewportElementRef.value) {
      return;
    }

    refreshScrollAreaHorizontalMetrics(scrollViewportElementRef.value);
  }, 16);

  const listColumnsTemplate = computed(() => {
    return buildListColumnsGridTemplate(
      columnVisibility.value,
      {
        fillWidth: listColumnFillWidth.value,
        columnWidths: userSettingsStore.userSettings.navigator.listColumnWidths,
        flexWeights: userSettingsStore.userSettings.navigator.listColumnFlexWeights,
        resizePreviewWidths: resizePreviewWidths.value,
        resizePreviewFlexWeights: resizePreviewFlexWeights.value,
        isResizing: activeResizeColumnId.value !== null,
      },
      listColumnOrder.value,
    );
  });

  function clearResizeState() {
    activeResizeColumnId.value = null;
    resizePreviewWidths.value = {};
    resizePreviewFlexWeights.value = {};
    resizeStartWidths.value = {};
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
  }

  async function persistColumnWidth(columnId: FileBrowserListColumnId, width: number) {
    const definition = getListColumnDefinition(columnId);
    const clampedWidth = clampListColumnWidth(width, definition.defaultMin);
    const savedWidths = userSettingsStore.userSettings.navigator.listColumnWidths;
    const currentWidth = savedWidths[columnId];

    if (currentWidth === clampedWidth) {
      return;
    }

    await userSettingsStore.set('navigator.listColumnWidths', {
      ...savedWidths,
      [columnId]: clampedWidth,
    });
  }

  function beginColumnResize(columnId: FileBrowserListColumnId, startWidth: number) {
    const definition = getListColumnDefinition(columnId);
    const resolvedStartWidth = clampListColumnWidth(startWidth, definition.defaultMin);

    activeResizeColumnId.value = columnId;

    if (listColumnFillWidth.value && headerGridElementRef.value) {
      const visibleDefinitions = getVisibleListColumnDefinitions(
        columnVisibility.value,
        listColumnOrder.value,
      );

      resizeStartWidths.value = measureHeaderColumnWidths(
        headerGridElementRef.value,
        columnVisibility.value,
        listColumnOrder.value,
      );
      resizePreviewFlexWeights.value = convertWidthsToFlexWeights(
        visibleDefinitions,
        resizeStartWidths.value,
      );
    }
    else {
      resizeStartWidths.value = {
        [columnId]: resolvedStartWidth,
      };
      resizePreviewWidths.value = {
        [columnId]: resolvedStartWidth,
      };
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function updateColumnResize(columnId: FileBrowserListColumnId, width: number) {
    const definition = getListColumnDefinition(columnId);

    if (listColumnFillWidth.value && Object.keys(resizeStartWidths.value).length > 0) {
      const visibleDefinitions = getVisibleListColumnDefinitions(
        columnVisibility.value,
        listColumnOrder.value,
      );

      const redistributedWidths = redistributeListColumnWidths(
        visibleDefinitions,
        resizeStartWidths.value,
        columnId,
        width,
      );

      resizePreviewFlexWeights.value = convertWidthsToFlexWeights(
        visibleDefinitions,
        redistributedWidths,
      );
      return;
    }

    resizePreviewWidths.value = {
      ...resizePreviewWidths.value,
      [columnId]: clampListColumnWidth(width, definition.defaultMin),
    };
  }

  async function finishColumnResize(columnId: FileBrowserListColumnId) {
    const previewFlexWeights = { ...resizePreviewFlexWeights.value };
    const previewWidths = { ...resizePreviewWidths.value };
    const isFillWidth = listColumnFillWidth.value;

    clearResizeState();

    if (isFillWidth && Object.keys(previewFlexWeights).length > 0) {
      await userSettingsStore.set('navigator.listColumnFlexWeights', {
        ...userSettingsStore.userSettings.navigator.listColumnFlexWeights,
        ...previewFlexWeights,
      });
      return;
    }

    const previewWidth = previewWidths[columnId];

    if (previewWidth !== undefined) {
      await persistColumnWidth(columnId, previewWidth);
    }
  }

  function cancelColumnResize() {
    clearResizeState();
  }

  watch(listColumnsTemplate, async () => {
    if (activeResizeColumnId.value !== null) {
      return;
    }

    await nextTick();
    refreshHorizontalScrollArea();
  }, { flush: 'post' });

  const context: FileBrowserListColumnsContext = {
    listColumnsTemplate,
    activeResizeColumnId,
    resizePreviewWidths,
    setMeasuredColumnWidths,
    setHeaderGridElement,
    setScrollViewportElement,
    beginColumnResize,
    updateColumnResize,
    finishColumnResize,
    cancelColumnResize,
  };

  provide(FILE_BROWSER_LIST_COLUMNS_KEY, context);

  return context;
}

export function useFileBrowserListColumns(): FileBrowserListColumnsContext {
  const context = inject(FILE_BROWSER_LIST_COLUMNS_KEY);

  if (!context) {
    throw new Error('useFileBrowserListColumns must be used within a file browser list columns provider');
  }

  return context;
}
