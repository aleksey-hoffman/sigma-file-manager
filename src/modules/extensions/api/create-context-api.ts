// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Disposable } from '@/types/extension';
import type { ExtensionPermission } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  getCurrentPath,
  getSelectedEntries,
  getAppVersion,
  getDownloadsDir,
  getPicturesDir,
  onPathChange,
  onSelectionChange,
  type ExtensionContextEntry,
} from '@/modules/extensions/context';

export function createContextAPI(context: ExtensionContext) {
  const openUrlPermission = 'openUrl' as ExtensionPermission;

  return {
    getCurrentPath: () => getCurrentPath(),
    getSelectedEntries: () => getSelectedEntries(),
    getAppVersion: () => getAppVersion(),
    getDownloadsDir: () => getDownloadsDir(),
    getPicturesDir: () => getPicturesDir(),
    openUrl: (url: string) => {
      if (!context.hasPermission(openUrlPermission)) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'openUrl' }));
      }

      const parsedUrl = new URL(url);
      const scheme = parsedUrl.protocol.toLowerCase();

      if (!['http:', 'https:', 'mailto:'].includes(scheme)) {
        throw new Error('Only http, https, and mailto URLs are allowed');
      }

      return openUrl(parsedUrl.toString());
    },
    onPathChange: (callback: (path: string | null) => void): Disposable => {
      return onPathChange(context.extensionId, callback);
    },
    onSelectionChange: (callback: (entries: ExtensionContextEntry[]) => void): Disposable => {
      return onSelectionChange(context.extensionId, callback);
    },
  };
}
