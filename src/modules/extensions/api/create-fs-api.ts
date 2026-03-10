// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type {
  ExtensionDirEntry,
  ExtensionScopedDirectory,
} from '@/types/extension';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

export function createFsAPI(context: ExtensionContext) {
  return {
    readFile: async (path: string): Promise<Uint8Array> => {
      if (!context.hasPermission('fs.read')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
      }

      if (!await context.isInAllowedReadDir(path)) {
        throw new Error(`Access denied: ${path} is not in scoped directories`);
      }

      const result = await invoke<number[]>('read_file_binary', { path });
      return new Uint8Array(result);
    },
    writeFile: async (path: string, data: Uint8Array): Promise<void> => {
      if (!context.hasPermission('fs.write')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.write' }));
      }

      const storageStore = useExtensionsStorageStore();

      if (!await context.isInExtensionDir(path) && !await storageStore.hasScopedAccess(context.extensionId, path, 'write')) {
        throw new Error(`Access denied: ${path} is not in scoped directories`);
      }

      await invoke('write_file_binary', {
        path,
        data: Array.from(data),
      });
    },
    readDir: async (path: string): Promise<ExtensionDirEntry[]> => {
      if (!context.hasPermission('fs.read')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
      }

      if (!await context.isInAllowedReadDir(path)) {
        throw new Error(`Access denied: ${path} is not in scoped directories`);
      }

      return invoke<ExtensionDirEntry[]>('read_dir', { path });
    },
    exists: async (path: string): Promise<boolean> => {
      if (!context.hasPermission('fs.read')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
      }

      if (!await context.isInAllowedReadDir(path)) {
        throw new Error(`Access denied: ${path} is not in scoped directories`);
      }

      return invoke<boolean>('path_exists', { path });
    },
    downloadFile: async (url: string, path: string): Promise<void> => {
      if (!context.hasPermission('fs.write')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.write' }));
      }

      if (!await context.isInExtensionDir(path)) {
        throw new Error(`Access denied: ${path} is not in extension directory`);
      }

      await invoke('download_extension_file', {
        extensionId: context.extensionId,
        filePath: path,
        url,
        integrity: null,
      });
    },
    private: {
      readFile: async (relativePath: string): Promise<Uint8Array> => {
        if (!context.hasPermission('fs.read')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const resolvedPath = await context.resolvePrivatePath(relativePath);
        const result = await invoke<number[]>('read_file_binary', { path: resolvedPath });
        return new Uint8Array(result);
      },
      writeFile: async (relativePath: string, data: Uint8Array): Promise<void> => {
        if (!context.hasPermission('fs.write')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.write' }));
        }

        const resolvedPath = await context.resolvePrivatePath(relativePath);
        await invoke('write_file_binary', {
          path: resolvedPath,
          data: Array.from(data),
        });
      },
      readDir: async (relativePath = ''): Promise<ExtensionDirEntry[]> => {
        if (!context.hasPermission('fs.read')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const resolvedPath = relativePath.trim().length > 0
          ? await context.resolvePrivatePath(relativePath)
          : await context.getExtensionPath();
        return invoke<ExtensionDirEntry[]>('read_dir', { path: resolvedPath });
      },
      exists: async (relativePath: string): Promise<boolean> => {
        if (!context.hasPermission('fs.read')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const resolvedPath = await context.resolvePrivatePath(relativePath);
        return invoke<boolean>('path_exists', { path: resolvedPath });
      },
      resolvePath: async (relativePath: string): Promise<string> => {
        return context.resolvePrivatePath(relativePath);
      },
    },
    storage: {
      readFile: async (relativePath: string): Promise<Uint8Array> => {
        if (!context.hasPermission('fs.read')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const resolvedPath = await context.resolveStoragePath(relativePath);
        const result = await invoke<number[]>('read_file_binary', { path: resolvedPath });
        return new Uint8Array(result);
      },
      writeFile: async (relativePath: string, data: Uint8Array): Promise<void> => {
        if (!context.hasPermission('fs.write')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.write' }));
        }

        const resolvedPath = await context.resolveStoragePath(relativePath);
        await invoke('write_file_binary', {
          path: resolvedPath,
          data: Array.from(data),
        });
      },
      readDir: async (relativePath = ''): Promise<ExtensionDirEntry[]> => {
        if (!context.hasPermission('fs.read')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const resolvedPath = relativePath.trim().length > 0
          ? await context.resolveStoragePath(relativePath)
          : await context.getExtensionStoragePath();
        return invoke<ExtensionDirEntry[]>('read_dir', { path: resolvedPath });
      },
      exists: async (relativePath: string): Promise<boolean> => {
        if (!context.hasPermission('fs.read')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const resolvedPath = await context.resolveStoragePath(relativePath);
        return invoke<boolean>('path_exists', { path: resolvedPath });
      },
      resolvePath: async (relativePath: string): Promise<string> => {
        return context.resolveStoragePath(relativePath);
      },
      importFile: async (sourcePath: string, targetRelativePath: string): Promise<string> => {
        if (!context.hasPermission('fs.read')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        if (!context.hasPermission('fs.write')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.write' }));
        }

        return invoke<string>('import_extension_storage_file', {
          extensionId: context.extensionId,
          sourcePath,
          targetRelativePath: context.normalizeRelativePath(targetRelativePath),
        });
      },
      deleteFile: async (relativePath: string): Promise<void> => {
        if (!context.hasPermission('fs.write')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.write' }));
        }

        const resolvedPath = await context.resolveStoragePath(relativePath);
        await invoke('delete_file_binary', { path: resolvedPath });
      },
    },
    scoped: {
      requestDirectoryAccess: async (options?: {
        permission?: 'read' | 'write' | 'readWrite';
        title?: string;
        defaultPath?: string;
      }): Promise<{ granted: boolean;
        path?: string;
        permissions?: ('read' | 'write')[]; }> => {
        const requestedPermission = options?.permission ?? 'read';

        if ((requestedPermission === 'read' || requestedPermission === 'readWrite') && !context.hasPermission('fs.read')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        if ((requestedPermission === 'write' || requestedPermission === 'readWrite') && !context.hasPermission('fs.write')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.write' }));
        }

        if (!context.hasPermission('dialogs')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'dialogs' }));
        }

        const selectedPath = await open({
          title: options?.title,
          defaultPath: options?.defaultPath,
          directory: true,
          multiple: false,
        });

        if (typeof selectedPath !== 'string' || selectedPath.trim().length === 0) {
          return { granted: false };
        }

        const scopedPermissions: ('read' | 'write')[] = requestedPermission === 'read'
          ? ['read']
          : requestedPermission === 'write'
            ? ['write']
            : ['read', 'write'];
        const storageStore = useExtensionsStorageStore();

        await storageStore.addScopedDirectory(context.extensionId, {
          path: selectedPath,
          permissions: scopedPermissions,
          grantedAt: Date.now(),
        });

        return {
          granted: true,
          path: selectedPath,
          permissions: scopedPermissions,
        };
      },
      getDirectories: async (): Promise<ExtensionScopedDirectory[]> => {
        const storageStore = useExtensionsStorageStore();
        const extensionSettings = await storageStore.getExtensionSettings(context.extensionId);
        return extensionSettings?.scopedDirectories ?? [];
      },
      readFile: async (path: string): Promise<Uint8Array> => {
        if (!context.hasPermission('fs.read')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const storageStore = useExtensionsStorageStore();

        if (!await storageStore.hasScopedAccess(context.extensionId, path, 'read')) {
          throw new Error(`Access denied: ${path} is not in scoped directories`);
        }

        const result = await invoke<number[]>('read_file_binary', { path });
        return new Uint8Array(result);
      },
      writeFile: async (path: string, data: Uint8Array): Promise<void> => {
        if (!context.hasPermission('fs.write')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.write' }));
        }

        const storageStore = useExtensionsStorageStore();

        if (!await storageStore.hasScopedAccess(context.extensionId, path, 'write')) {
          throw new Error(`Access denied: ${path} is not in scoped directories`);
        }

        await invoke('write_file_binary', {
          path,
          data: Array.from(data),
        });
      },
      readDir: async (path: string): Promise<ExtensionDirEntry[]> => {
        if (!context.hasPermission('fs.read')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const storageStore = useExtensionsStorageStore();

        if (!await storageStore.hasScopedAccess(context.extensionId, path, 'read')) {
          throw new Error(`Access denied: ${path} is not in scoped directories`);
        }

        return invoke<ExtensionDirEntry[]>('read_dir', { path });
      },
      exists: async (path: string): Promise<boolean> => {
        if (!context.hasPermission('fs.read')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const storageStore = useExtensionsStorageStore();

        if (!await storageStore.hasScopedAccess(context.extensionId, path, 'read')) {
          throw new Error(`Access denied: ${path} is not in scoped directories`);
        }

        return invoke<boolean>('path_exists', { path });
      },
    },
  };
}
