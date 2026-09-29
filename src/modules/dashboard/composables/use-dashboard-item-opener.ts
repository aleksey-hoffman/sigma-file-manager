// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { useRouter } from 'vue-router';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import {
  openNavigatorContainingDirectory,
  openNavigatorPath,
} from '@/utils/open-navigator-directory';
import { openPathDefault } from '@/utils/open-path-default';
import { resolveNavigableItemTarget } from '@/utils/resolve-navigable-item-target';

export function useDashboardItemOpener() {
  const router = useRouter();
  const userStatsStore = useUserStatsStore();

  async function openItem(path: string, isFile: boolean) {
    try {
      const navigableItemTarget = await resolveNavigableItemTarget(path, isFile);

      if (!navigableItemTarget.opensAsFile) {
        openNavigatorPath(router, navigableItemTarget.targetPath);
        return;
      }

      await openPathDefault(navigableItemTarget.targetPath);
      await userStatsStore.recordItemOpen(navigableItemTarget.targetPath, true);
    }
    catch (error) {
      console.error('Failed to open item:', error);
    }
  }

  function openContainingFolder(path: string) {
    openNavigatorContainingDirectory(router, path);
  }

  return {
    openItem,
    openContainingFolder,
  };
}
