// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ExtensionContextMenuItem, ContextMenuContext, Disposable } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { addContextMenuRegistration } from '@/modules/extensions/api/registrations';

export function createContextMenuAPI(context: ExtensionContext) {
  return {
    registerItem: (
      item: ExtensionContextMenuItem,
      handler: (context: ContextMenuContext) => Promise<void> | void,
    ): Disposable => {
      if (!context.hasPermission('contextMenu')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'contextMenu' }));
      }

      return addContextMenuRegistration({
        extensionId: context.extensionId,
        item: {
          ...item,
          id: `${context.extensionId}.${item.id}`,
        },
        handler,
      });
    },
  };
}
