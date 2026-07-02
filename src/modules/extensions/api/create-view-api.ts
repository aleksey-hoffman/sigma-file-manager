// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type {
  ExtensionViewLayout,
  ExtensionViewSetSortingOptions,
  ExtensionViewSorting,
} from '@sigma-file-manager/api';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  buildExtensionViewSortingUpdates,
  isExtensionViewLayout,
  readExtensionViewLayout,
  readExtensionViewSorting,
  toNavigatorLayoutType,
} from '@/modules/extensions/utils/extension-view-settings';

function assertViewPermission(context: ExtensionContext): void {
  if (!context.hasPermission('view')) {
    throw new Error(context.t('extensions.api.permissionDenied', { permission: 'view' }));
  }
}

export function createViewAPI(context: ExtensionContext) {
  return {
    getLayout: async (): Promise<ExtensionViewLayout> => {
      assertViewPermission(context);
      const userSettingsStore = useUserSettingsStore();
      return readExtensionViewLayout(userSettingsStore.userSettings.navigator);
    },
    setLayout: async (mode: ExtensionViewLayout): Promise<void> => {
      assertViewPermission(context);

      if (!isExtensionViewLayout(mode)) {
        throw new Error(`Invalid layout mode: ${mode}`);
      }

      const userSettingsStore = useUserSettingsStore();
      await userSettingsStore.set(
        'navigator.layout.type',
        toNavigatorLayoutType(mode),
      );
    },
    getSorting: async (): Promise<ExtensionViewSorting> => {
      assertViewPermission(context);
      const userSettingsStore = useUserSettingsStore();
      const navigator = userSettingsStore.userSettings.navigator;
      const layout = readExtensionViewLayout(navigator);
      return readExtensionViewSorting(navigator, layout);
    },
    setSorting: async (options: ExtensionViewSetSortingOptions): Promise<void> => {
      assertViewPermission(context);
      const userSettingsStore = useUserSettingsStore();
      const navigator = userSettingsStore.userSettings.navigator;
      const layout = readExtensionViewLayout(navigator);
      const updates = buildExtensionViewSortingUpdates(navigator, layout, options);

      for (const update of updates) {
        await userSettingsStore.set(update.key, update.value);
      }
    },
  };
}
