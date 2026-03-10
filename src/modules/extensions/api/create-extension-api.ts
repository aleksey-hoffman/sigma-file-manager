// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { SigmaExtensionAPI } from '@sigma-file-manager/api';
import type { ExtensionPermission } from '@/types/extension';
import { freezeObject } from '@/modules/extensions/runtime/sandbox';
import { createExtensionContext } from '@/modules/extensions/api/extension-context';
import { createContextMenuAPI } from '@/modules/extensions/api/create-context-menu-api';
import { createSidebarAPI } from '@/modules/extensions/api/create-sidebar-api';
import { createToolbarAPI } from '@/modules/extensions/api/create-toolbar-api';
import { createCommandsAPI } from '@/modules/extensions/api/create-commands-api';
import { createContextAPI } from '@/modules/extensions/api/create-context-api';
import { createDialogAPI } from '@/modules/extensions/api/create-dialog-api';
import { createShellAPI } from '@/modules/extensions/api/create-shell-api';
import { createFsAPI } from '@/modules/extensions/api/create-fs-api';
import { createUiAPI } from '@/modules/extensions/api/create-ui-api';
import { createStorageAPI } from '@/modules/extensions/api/create-storage-api';
import { createSettingsAPI } from '@/modules/extensions/api/create-settings-api';
import { createPlatformAPI } from '@/modules/extensions/api/create-platform-api';
import { createBinaryAPI } from '@/modules/extensions/api/create-binary-api';
import { createI18nAPI } from '@/modules/extensions/api/create-i18n-api';

export function createExtensionAPI(
  extensionId: string,
  permissions: ExtensionPermission[],
): SigmaExtensionAPI {
  const context = createExtensionContext(extensionId, permissions);
  const commandsAPI = createCommandsAPI(context);

  const api: SigmaExtensionAPI = {
    i18n: createI18nAPI(context),
    contextMenu: createContextMenuAPI(context),
    sidebar: createSidebarAPI(context),
    toolbar: createToolbarAPI(context),
    commands: commandsAPI,
    context: createContextAPI(context),
    fs: createFsAPI(context),
    ui: createUiAPI(context),
    dialog: createDialogAPI(context, commandsAPI.executeCommand),
    shell: createShellAPI(context),
    settings: createSettingsAPI(context),
    storage: createStorageAPI(context),
    platform: createPlatformAPI(),
    binary: createBinaryAPI(context),
  };

  return freezeObject(api);
}
