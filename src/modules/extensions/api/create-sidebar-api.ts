// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ExtensionSidebarItem, Disposable } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { addSidebarRegistration } from '@/modules/extensions/api/registrations';

export function createSidebarAPI(context: ExtensionContext) {
  return {
    registerPage: (page: ExtensionSidebarItem): Disposable => {
      if (!context.hasPermission('sidebar')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'sidebar' }));
      }

      return addSidebarRegistration({
        extensionId: context.extensionId,
        page: {
          ...page,
          id: `${context.extensionId}.${page.id}`,
        },
      });
    },
  };
}
