// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import type { DismissalLayerType } from '@/stores/runtime/dismissal-layer';

type DismissalLayerStore = {
  registerLayer: (type: DismissalLayerType, dismiss: () => void, priority?: number, customId?: string) => string;
  unregisterLayer: (id: string) => void;
  layers: Map<string, { type: DismissalLayerType }>;
  hasLayerOfType: (type: DismissalLayerType) => boolean;
};

type GlobalSearchStore = {
  isOpen: boolean;
};

export function useFileBrowserFilter(options: {
  dismissalLayerStore: DismissalLayerStore;
  globalSearchStore: GlobalSearchStore;
  currentPath?: Ref<string>;
  componentRef?: Ref<HTMLElement | null>;
  isDefaultPane?: boolean;
  isActivePane?: () => boolean;
}) {
  const filterQuery = ref('');
  const isFilterOpen = ref(false);
  const shouldFocusFilterInput = ref(false);
  const filterDismissalLayerId = ref<string | null>(null);

  function closeFilter() {
    isFilterOpen.value = false;
    shouldFocusFilterInput.value = false;
    filterQuery.value = '';
  }

  function toggleFilter() {
    if (options.globalSearchStore.isOpen) {
      return;
    }

    isFilterOpen.value = !isFilterOpen.value;
  }

  function openFilter() {
    if (options.globalSearchStore.isOpen) {
      return;
    }

    shouldFocusFilterInput.value = false;
    isFilterOpen.value = true;
  }

  function focusFilter() {
    if (options.globalSearchStore.isOpen) {
      return;
    }

    shouldFocusFilterInput.value = true;
    isFilterOpen.value = true;
  }

  function clearFilterInputFocusRequest() {
    shouldFocusFilterInput.value = false;
  }

  function isCursorInsideTextField(): boolean {
    const activeElement = document.activeElement;

    if (!activeElement) {
      return false;
    }

    const tagName = activeElement.tagName.toLowerCase();
    const isTextInput = tagName === 'input' || tagName === 'textarea';
    const isContentEditable = (activeElement as HTMLElement).isContentEditable;

    return isTextInput || isContentEditable;
  }

  function isActiveInThisFileBrowserPane(): boolean {
    const rootEl = options.componentRef?.value;
    const activeElement = document.activeElement;
    const isActivePane = options.isActivePane?.() ?? (options.isDefaultPane ?? true);

    if (!rootEl) {
      return isActivePane;
    }

    if (activeElement && rootEl.contains(activeElement)) {
      return true;
    }

    const focusInAnyPane = Array.from(document.querySelectorAll('.file-browser')).some(
      paneEl => paneEl.contains(activeElement),
    );

    if (focusInAnyPane) {
      return false;
    }

    return isActivePane;
  }

  function hasBlockingRekaDismissableLayers(): boolean {
    const nodes = document.querySelectorAll('[data-dismissable-layer]');

    for (const node of nodes) {
      if (!node.closest('[data-file-browser-toolbar-filter-popover]')) {
        return true;
      }
    }

    return false;
  }

  function hasBlockingDismissalLayers(): boolean {
    for (const layer of options.dismissalLayerStore.layers.values()) {
      if (layer.type !== 'filter') {
        return true;
      }
    }

    return false;
  }

  function isFilterTypingKey(key: string): boolean {
    return /^[a-z0-9]$/i.test(key);
  }

  function shouldApplyKeyToFilterQuery(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return false;
    }

    if (event.key === 'Backspace') {
      return isFilterOpen.value;
    }

    return isFilterTypingKey(event.key);
  }

  function applyKeyToFilterQuery(event: KeyboardEvent) {
    if (event.key === 'Backspace') {
      filterQuery.value = filterQuery.value.slice(0, -1);
      event.preventDefault();
      return;
    }

    if (isFilterTypingKey(event.key)) {
      filterQuery.value += event.key;
      event.preventDefault();
    }
  }

  function handleKeydownForFilter(event: KeyboardEvent) {
    if (isCursorInsideTextField()) {
      return;
    }

    if (options.dismissalLayerStore.hasLayerOfType('drag')) {
      return;
    }

    const extendOpenFilter = isFilterOpen.value && shouldApplyKeyToFilterQuery(event);

    if (extendOpenFilter) {
      if (hasBlockingRekaDismissableLayers()) {
        return;
      }

      if (!isActiveInThisFileBrowserPane()) {
        return;
      }

      applyKeyToFilterQuery(event);
      return;
    }

    if (hasBlockingDismissalLayers()) {
      return;
    }

    if (hasBlockingRekaDismissableLayers()) {
      return;
    }

    if (shouldApplyKeyToFilterQuery(event)) {
      if (!isActiveInThisFileBrowserPane()) {
        return;
      }

      openFilter();
      filterQuery.value += event.key;
      event.preventDefault();
    }
  }

  watch(isFilterOpen, (isOpen) => {
    if (isOpen) {
      filterDismissalLayerId.value = options.dismissalLayerStore.registerLayer(
        'filter',
        () => closeFilter(),
        100,
      );
    }
    else {
      if (filterDismissalLayerId.value) {
        options.dismissalLayerStore.unregisterLayer(filterDismissalLayerId.value);
        filterDismissalLayerId.value = null;
      }

      shouldFocusFilterInput.value = false;
      filterQuery.value = '';
    }
  });

  watch(() => options.globalSearchStore.isOpen, (isGlobalSearchOpen) => {
    if (isGlobalSearchOpen && isFilterOpen.value) {
      closeFilter();
    }
  });

  if (options.currentPath) {
    watch(options.currentPath, (newPath, oldPath) => {
      if (oldPath !== undefined && newPath !== oldPath) {
        closeFilter();
      }
    });
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydownForFilter);
  });

  onUnmounted(() => {
    if (filterDismissalLayerId.value) {
      options.dismissalLayerStore.unregisterLayer(filterDismissalLayerId.value);
    }

    window.removeEventListener('keydown', handleKeydownForFilter);
  });

  return {
    filterQuery,
    isFilterOpen,
    shouldFocusFilterInput,
    toggleFilter,
    openFilter,
    focusFilter,
    clearFilterInputFocusRequest,
    closeFilter,
  };
}
