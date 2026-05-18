// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { onMounted, watch } from 'vue';
import type { Ref } from 'vue';
import type { Tab } from '@/types/workspaces';
import normalizePath from '@/utils/normalize-path';

export function useFileBrowserLifecycle(options: {
  tabRef: Ref<Tab | undefined>;
  currentPath: Ref<string>;
  readDir: (path: string, addToHistory: boolean) => Promise<void>;
  init: () => void;
  shouldAddExternalPathToHistory?: (tabId: string, path: string) => boolean;
}) {
  onMounted(() => {
    options.init();
  });

  watch(() => ({
    id: options.tabRef.value?.id,
    path: options.tabRef.value?.path,
  }), async (currentTab, previousTab) => {
    if (!currentTab.id || !currentTab.path) {
      return;
    }

    const pathChangedExternally = normalizePath(currentTab.path) !== normalizePath(options.currentPath.value);

    if (currentTab.id !== previousTab?.id || pathChangedExternally) {
      const addToHistory = currentTab.id === previousTab?.id
        && pathChangedExternally
        && (options.shouldAddExternalPathToHistory?.(currentTab.id, currentTab.path) ?? false);

      await options.readDir(currentTab.path, addToHistory);
    }
  });
}
