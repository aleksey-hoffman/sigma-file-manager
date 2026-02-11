// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { DismissalLayerType } from '@/stores/runtime/dismissal-layer';

type DismissalLayerStore = {
  registerLayer: (type: DismissalLayerType, dismiss: () => void, priority?: number, customId?: string) => string;
  unregisterLayer: (id: string) => void;
  hasLayers: boolean;
};

type GlobalSearchStore = {
  isOpen: boolean;
};

type UserSettingsStore = {
  userSettings: {
    navigator: {
      focusFilterOnTyping: boolean;
    };
  };
};

export function useFileBrowserFilter(options: {
  userSettingsStore: UserSettingsStore;
  dismissalLayerStore: DismissalLayerStore;
  globalSearchStore: GlobalSearchStore;
}) {
  const filterQuery = ref('');
  const isFilterOpen = ref(false);
  const filterDismissalLayerId = ref<string | null>(null);

  function closeFilter() {
    isFilterOpen.value = false;
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

    isFilterOpen.value = true;
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

  function handleKeydownForFilter(event: KeyboardEvent) {
    if (!options.userSettingsStore.userSettings.navigator.focusFilterOnTyping) {
      return;
    }

    if (isCursorInsideTextField()) {
      return;
    }

    if (options.dismissalLayerStore.hasLayers) {
      return;
    }

    const hasRekaDismissableLayers = document.querySelectorAll('[data-dismissable-layer]').length > 0;

    if (hasRekaDismissableLayers) {
      return;
    }

    const keyIsAlphaNum = (event.keyCode >= 48 && event.keyCode <= 90);
    const hasModifiers = event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;

    if (keyIsAlphaNum && !hasModifiers) {
      openFilter();
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

      filterQuery.value = '';
    }
  });

  watch(() => options.globalSearchStore.isOpen, (isGlobalSearchOpen) => {
    if (isGlobalSearchOpen && isFilterOpen.value) {
      closeFilter();
    }
  });

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
    toggleFilter,
    openFilter,
    closeFilter,
  };
}
