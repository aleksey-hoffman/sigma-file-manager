// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, type Ref } from 'vue';
import { getVersion } from '@tauri-apps/api/app';
import { downloadDir, pictureDir } from '@tauri-apps/api/path';
import type { DirEntry } from '@/types/dir-entry';
import type { Disposable, ExtensionContextEntry } from '@/types/extension';

export type { ExtensionContextEntry };

export type ExtensionContext = {
  currentPath: string | null;
  selectedEntries: ExtensionContextEntry[];
  appVersion: string;
};

type NavigationContextProvider = {
  getCurrentPath: () => string | null;
  getSelectedEntries: () => DirEntry[];
};

type PathChangeCallback = (path: string | null) => void;
type SelectionChangeCallback = (entries: ExtensionContextEntry[]) => void;

type PathChangeListenerEntry = {
  extensionId: string;
  callback: PathChangeCallback;
};

type SelectionChangeListenerEntry = {
  extensionId: string;
  callback: SelectionChangeCallback;
};

const navigationProvider: Ref<NavigationContextProvider | null> = ref(null);
let cachedAppVersion: string | null = null;

const pathChangeListeners: PathChangeListenerEntry[] = [];
const selectionChangeListeners: SelectionChangeListenerEntry[] = [];

export function emitPathChange(path: string | null): void {
  for (const entry of pathChangeListeners) {
    try {
      entry.callback(path);
    }
    catch (error) {
      console.error('[Extensions] Path change listener error:', error);
    }
  }
}

export function emitSelectionChange(entries: DirEntry[]): void {
  const contextEntries = entries.map(convertDirEntryToContextEntry);

  for (const entry of selectionChangeListeners) {
    try {
      entry.callback(contextEntries);
    }
    catch (error) {
      console.error('[Extensions] Selection change listener error:', error);
    }
  }
}

export function onPathChange(extensionId: string, callback: PathChangeCallback): Disposable {
  const entry: PathChangeListenerEntry = {
    extensionId,
    callback,
  };
  pathChangeListeners.push(entry);
  return {
    dispose: () => {
      const index = pathChangeListeners.indexOf(entry);

      if (index !== -1) {
        pathChangeListeners.splice(index, 1);
      }
    },
  };
}

export function onSelectionChange(extensionId: string, callback: SelectionChangeCallback): Disposable {
  const entry: SelectionChangeListenerEntry = {
    extensionId,
    callback,
  };
  selectionChangeListeners.push(entry);
  return {
    dispose: () => {
      const index = selectionChangeListeners.indexOf(entry);

      if (index !== -1) {
        selectionChangeListeners.splice(index, 1);
      }
    },
  };
}

export function clearExtensionContextListeners(extensionId: string): void {
  for (let index = pathChangeListeners.length - 1; index >= 0; index--) {
    if (pathChangeListeners[index].extensionId === extensionId) {
      pathChangeListeners.splice(index, 1);
    }
  }

  for (let index = selectionChangeListeners.length - 1; index >= 0; index--) {
    if (selectionChangeListeners[index].extensionId === extensionId) {
      selectionChangeListeners.splice(index, 1);
    }
  }
}

export function registerNavigationProvider(provider: NavigationContextProvider): void {
  navigationProvider.value = provider;
}

export function unregisterNavigationProvider(): void {
  navigationProvider.value = null;
}

function convertDirEntryToContextEntry(entry: DirEntry): ExtensionContextEntry {
  return {
    path: entry.path,
    name: entry.name,
    isDirectory: entry.is_dir,
    isFile: entry.is_file,
    size: entry.size,
    extension: entry.ext ?? null,
    createdAt: entry.created_time,
    modifiedAt: entry.modified_time,
  };
}

export async function getExtensionContext(): Promise<ExtensionContext> {
  if (!cachedAppVersion) {
    cachedAppVersion = await getVersion();
  }

  const provider = navigationProvider.value;

  if (!provider) {
    return {
      currentPath: null,
      selectedEntries: [],
      appVersion: cachedAppVersion,
    };
  }

  const selectedDirEntries = provider.getSelectedEntries();

  return {
    currentPath: provider.getCurrentPath(),
    selectedEntries: selectedDirEntries.map(convertDirEntryToContextEntry),
    appVersion: cachedAppVersion,
  };
}

export function getCurrentPath(): string | null {
  return navigationProvider.value?.getCurrentPath() ?? null;
}

export function getSelectedEntries(): ExtensionContextEntry[] {
  const provider = navigationProvider.value;

  if (!provider) {
    return [];
  }

  return provider.getSelectedEntries().map(convertDirEntryToContextEntry);
}

export async function getAppVersion(): Promise<string> {
  if (!cachedAppVersion) {
    cachedAppVersion = await getVersion();
  }

  return cachedAppVersion;
}

export async function getDownloadsDir(): Promise<string> {
  return downloadDir();
}

export async function getPicturesDir(): Promise<string> {
  return pictureDir();
}
