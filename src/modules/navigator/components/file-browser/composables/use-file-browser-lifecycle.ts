// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { onMounted, watch } from 'vue';
import type { Ref } from 'vue';
import type { Tab } from '@/types/workspaces';

export function useFileBrowserLifecycle(options: {
  tabRef: Ref<Tab | undefined>;
  readDir: (path: string, shouldRefresh: boolean) => Promise<void>;
  init: () => void;
}) {
  onMounted(() => {
    options.init();
  });

  watch(() => options.tabRef.value?.id, async (newTabId, oldTabId) => {
    if (newTabId && newTabId !== oldTabId && options.tabRef.value?.path) {
      await options.readDir(options.tabRef.value.path, false);
    }
  });
}
