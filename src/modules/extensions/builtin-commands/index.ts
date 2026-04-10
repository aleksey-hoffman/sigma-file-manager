// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, type Ref } from 'vue';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { ExtensionPermission } from '@/types/extension';
import { useQuickViewStore } from '@/stores/runtime/quick-view';
import router from '@/router';

export type BuiltinCommandDefinition = {
  id: string;
  title: string;
  description: string;
  requiredPermission?: ExtensionPermission;
  showInPalette?: boolean;
  parameters?: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
};

export type FileDialogFilter = {
  name: string;
  extensions: string[];
};

export type OpenFileDialogOptions = {
  title?: string;
  defaultPath?: string;
  filters?: FileDialogFilter[];
  multiple?: boolean;
  directory?: boolean;
};

export type SaveFileDialogOptions = {
  title?: string;
  defaultPath?: string;
  filters?: FileDialogFilter[];
};

type NavigateToPathFn = (path: string) => Promise<void>;

const navigateToPathFn: Ref<NavigateToPathFn | null> = ref(null);

export function registerNavigateToPath(fn: NavigateToPathFn): void {
  navigateToPathFn.value = fn;
}

export function unregisterNavigateToPath(): void {
  navigateToPathFn.value = null;
}

export const BUILTIN_COMMANDS: BuiltinCommandDefinition[] = [
  {
    id: 'sigma.navigator.openPath',
    title: 'Open Path',
    description: 'Navigate to a specific path in the file browser',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'The path to navigate to',
        required: true,
      },
    ],
  },
  {
    id: 'sigma.quickView.open',
    title: 'Open Quick View',
    description: 'Open a file in the quick view window',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'The file path to preview',
        required: true,
      },
    ],
  },
  {
    id: 'sigma.quickView.close',
    title: 'Close Quick View',
    description: 'Close the quick view window',
  },
  {
    id: 'sigma.dialog.openFile',
    title: 'Open File Dialog',
    description: 'Show the native file open dialog',
    requiredPermission: 'dialogs',
    parameters: [
      {
        name: 'options',
        type: 'OpenFileDialogOptions',
        description: 'Dialog options',
        required: false,
      },
    ],
  },
  {
    id: 'sigma.dialog.saveFile',
    title: 'Save File Dialog',
    description: 'Show the native file save dialog',
    requiredPermission: 'dialogs',
    parameters: [
      {
        name: 'options',
        type: 'SaveFileDialogOptions',
        description: 'Dialog options',
        required: false,
      },
    ],
  },
  {
    id: 'sigma.app.openSettings',
    title: 'Open Settings',
    description: 'Open the settings page',
    showInPalette: true,
  },
  {
    id: 'sigma.app.openExtensions',
    title: 'Open Extensions',
    description: 'Open the extensions page',
    showInPalette: true,
  },
  {
    id: 'sigma.app.openExtensionPage',
    title: 'Open Extension Page',
    description: 'Open a specific extension page',
    parameters: [
      {
        name: 'fullPageId',
        type: 'string',
        description: 'The full extension page id to open',
        required: true,
      },
    ],
  },
  {
    id: 'sigma.app.reloadWindow',
    title: 'Reload Window',
    description: 'Reload the application window',
    showInPalette: true,
  },
];

type BuiltinCommandHandler = (...args: unknown[]) => Promise<unknown>;

const builtinCommandHandlers: Map<string, BuiltinCommandHandler> = new Map();

function initializeHandlers(): void {
  builtinCommandHandlers.set('sigma.navigator.openPath', async (path: unknown) => {
    if (typeof path !== 'string') {
      throw new Error('sigma.navigator.openPath requires a string path argument');
    }

    if (!navigateToPathFn.value) {
      throw new Error('Navigation is not available');
    }

    await navigateToPathFn.value(path);
  });

  builtinCommandHandlers.set('sigma.quickView.open', async (path: unknown) => {
    if (typeof path !== 'string') {
      throw new Error('sigma.quickView.open requires a string path argument');
    }

    const quickViewStore = useQuickViewStore();
    return await quickViewStore.openFileFromMainWindow(path);
  });

  builtinCommandHandlers.set('sigma.quickView.close', async () => {
    const quickViewStore = useQuickViewStore();
    await quickViewStore.closeWindow();
  });

  builtinCommandHandlers.set('sigma.dialog.openFile', async (options?: unknown) => {
    const dialogOptions = options as OpenFileDialogOptions | undefined;

    const result = await open({
      title: dialogOptions?.title,
      defaultPath: dialogOptions?.defaultPath,
      filters: dialogOptions?.filters,
      multiple: dialogOptions?.multiple ?? false,
      directory: dialogOptions?.directory ?? false,
    });

    return result;
  });

  builtinCommandHandlers.set('sigma.dialog.saveFile', async (options?: unknown) => {
    const dialogOptions = options as SaveFileDialogOptions | undefined;

    const result = await save({
      title: dialogOptions?.title,
      defaultPath: dialogOptions?.defaultPath,
      filters: dialogOptions?.filters,
    });

    return result;
  });

  builtinCommandHandlers.set('sigma.app.openSettings', async () => {
    await router.push({ name: 'settings' });
  });

  builtinCommandHandlers.set('sigma.app.openExtensions', async () => {
    await router.push({ name: 'extensions' });
  });

  builtinCommandHandlers.set('sigma.app.openExtensionPage', async (fullPageId: unknown) => {
    if (typeof fullPageId !== 'string') {
      throw new Error('sigma.app.openExtensionPage requires a string fullPageId argument');
    }

    await router.push({
      name: 'extension-page',
      params: { fullPageId },
    });
  });

  builtinCommandHandlers.set('sigma.app.reloadWindow', async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.location.reload();
  });
}

initializeHandlers();

export function getBuiltinCommandHandler(commandId: string): BuiltinCommandHandler | undefined {
  return builtinCommandHandlers.get(commandId);
}

export function getBuiltinCommandRequiredPermission(commandId: string): ExtensionPermission | undefined {
  return BUILTIN_COMMANDS.find(command => command.id === commandId)?.requiredPermission;
}

export function isBuiltinCommand(commandId: string): boolean {
  return commandId.startsWith('sigma.');
}

export function getBuiltinCommandDefinitions(): BuiltinCommandDefinition[] {
  return [...BUILTIN_COMMANDS];
}
