// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright � 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import type { BinaryInfo } from '@/types/extension';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

const BINARY_STORAGE_KEY = '__binaries';

function cloneBinaryInfo(info: BinaryInfo): BinaryInfo {
  return JSON.parse(JSON.stringify(info)) as BinaryInfo;
}

export function createBinaryAPI(context: ExtensionContext) {
  async function getBinaryStorage(): Promise<Record<string, BinaryInfo>> {
    const storageStore = useExtensionsStorageStore();
    const settings = await storageStore.getExtensionSettings(context.extensionId);
    return (settings?.customSettings?.[BINARY_STORAGE_KEY] as Record<string, BinaryInfo>) || {};
  }

  function ensureBinaryPermission(): void {
    if (!context.hasPermission('shell')) {
      throw new Error(context.t('extensions.api.permissionDeniedBinary'));
    }
  }

  async function resolveInstalledBinaryInfo(id: string): Promise<BinaryInfo | null> {
    const binaries = await getBinaryStorage();
    const info = binaries[id];

    if (!info?.path) {
      return null;
    }

    try {
      const pathExists = await invoke<boolean>('path_exists', { path: info.path });
      return pathExists ? info : null;
    }
    catch {
      return null;
    }
  }

  return {
    getPath: async (id: string): Promise<string | null> => {
      ensureBinaryPermission();
      const info = await resolveInstalledBinaryInfo(id);
      return info?.path ?? null;
    },
    isInstalled: async (id: string): Promise<boolean> => {
      ensureBinaryPermission();
      const info = await resolveInstalledBinaryInfo(id);
      return info !== null;
    },
    getInfo: async (id: string): Promise<BinaryInfo | null> => {
      ensureBinaryPermission();
      const info = await resolveInstalledBinaryInfo(id);
      return info ? cloneBinaryInfo(info) : null;
    },
  };
}
