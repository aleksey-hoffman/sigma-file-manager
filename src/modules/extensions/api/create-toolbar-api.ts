// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ExtensionToolbarDropdown, Disposable } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { addToolbarRegistration } from '@/modules/extensions/api/registrations';

export function createToolbarAPI(context: ExtensionContext) {
  return {
    registerDropdown: (
      dropdown: ExtensionToolbarDropdown,
      handlers: Record<string, () => Promise<void> | void>,
    ): Disposable => {
      if (!context.hasPermission('toolbar')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'toolbar' }));
      }

      return addToolbarRegistration({
        extensionId: context.extensionId,
        dropdown: {
          ...dropdown,
          id: `${context.extensionId}.${dropdown.id}`,
          items: dropdown.items.map(item => ({
            ...item,
            id: `${context.extensionId}.${item.id}`,
          })),
        },
        handlers: Object.fromEntries(
          Object.entries(handlers).map(([key, value]) => [`${context.extensionId}.${key}`, value]),
        ),
      });
    },
  };
}
