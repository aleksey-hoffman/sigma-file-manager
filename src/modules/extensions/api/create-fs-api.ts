// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { open } from '@tauri-apps/plugin-dialog';
import type {
  ExtensionDirEntry,
  ExtensionScopedDirectory,
} from '@/types/extension';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { invokeAsExtension } from '@/modules/extensions/runtime/extension-invoke';

export function createFsAPI(context: ExtensionContext) {
  function requirePermission(permission: 'fs.read' | 'fs.write'): void {
    if (!context.hasPermission(permission)) {
      throw new Error(context.t('extensions.api.permissionDenied', { permission }));
    }
  }

  async function requireReadAccess(path: string): Promise<void> {
    requirePermission('fs.read');

    if (!await context.isInAllowedReadDir(path)) {
      throw new Error(`Access denied: ${path} is not in allowed directories`);
    }
  }

  async function requireScopedReadAccess(path: string): Promise<void> {
    requirePermission('fs.read');
    const storageStore = useExtensionsStorageStore();

    if (!await storageStore.hasScopedAccess(context.extensionId, path, 'read')) {
      throw new Error(`Access denied: ${path} is not in scoped directories`);
    }
  }

  async function requireScopedWriteAccess(path: string): Promise<void> {
    requirePermission('fs.write');
    const storageStore = useExtensionsStorageStore();

    if (!await storageStore.hasScopedAccess(context.extensionId, path, 'write')) {
      throw new Error(`Access denied: ${path} is not in scoped directories`);
    }
  }

  return {
    readFile: async (path: string): Promise<Uint8Array> => {
      await requireReadAccess(path);
      const result = await invokeAsExtension<number[]>(context.extensionId, 'read_file_binary', { path });
      return new Uint8Array(result);
    },
    writeFile: async (path: string, data: Uint8Array): Promise<void> => {
      requirePermission('fs.write');

      const hasDialogAccess = context.consumeDialogWriteAccess(path);

      if (!hasDialogAccess) {
        const storageStore = useExtensionsStorageStore();

        if (!await context.isInExtensionDir(path) && !await storageStore.hasScopedAccess(context.extensionId, path, 'write')) {
          throw new Error(`Access denied: ${path} is not in allowed directories`);
        }
      }

      await invokeAsExtension<void>(context.extensionId, 'write_file_binary', {
        path,
        data: Array.from(data),
      });
    },
    readDir: async (path: string): Promise<ExtensionDirEntry[]> => {
      await requireReadAccess(path);
      return invokeAsExtension<ExtensionDirEntry[]>(context.extensionId, 'read_dir', { path });
    },
    exists: async (path: string): Promise<boolean> => {
      await requireReadAccess(path);
      return invokeAsExtension<boolean>(context.extensionId, 'path_exists', { path });
    },
    downloadFile: async (url: string, path: string): Promise<void> => {
      requirePermission('fs.write');

      if (!await context.isInExtensionDir(path)) {
        throw new Error(`Access denied: ${path} is not in extension directory`);
      }

      await invokeAsExtension<void>(context.extensionId, 'download_extension_file', {
        extensionId: context.extensionId,
        filePath: path,
        url,
        integrity: null,
      });
    },
    private: {
      readFile: async (relativePath: string): Promise<Uint8Array> => {
        requirePermission('fs.read');
        const resolvedPath = await context.resolvePrivatePath(relativePath);
        const result = await invokeAsExtension<number[]>(context.extensionId, 'read_file_binary', { path: resolvedPath });
        return new Uint8Array(result);
      },
      writeFile: async (relativePath: string, data: Uint8Array): Promise<void> => {
        requirePermission('fs.write');
        const resolvedPath = await context.resolvePrivatePath(relativePath);
        await invokeAsExtension<void>(context.extensionId, 'write_file_binary', {
          path: resolvedPath,
          data: Array.from(data),
        });
      },
      readDir: async (relativePath = ''): Promise<ExtensionDirEntry[]> => {
        requirePermission('fs.read');
        const resolvedPath = relativePath.trim().length > 0
          ? await context.resolvePrivatePath(relativePath)
          : await context.getExtensionPath();
        return invokeAsExtension<ExtensionDirEntry[]>(context.extensionId, 'read_dir', { path: resolvedPath });
      },
      exists: async (relativePath: string): Promise<boolean> => {
        requirePermission('fs.read');
        const resolvedPath = await context.resolvePrivatePath(relativePath);
        return invokeAsExtension<boolean>(context.extensionId, 'path_exists', { path: resolvedPath });
      },
      resolvePath: async (relativePath: string): Promise<string> => {
        return context.resolvePrivatePath(relativePath);
      },
    },
    storage: {
      readFile: async (relativePath: string): Promise<Uint8Array> => {
        requirePermission('fs.read');
        const resolvedPath = await context.resolveStoragePath(relativePath);
        const result = await invokeAsExtension<number[]>(context.extensionId, 'read_file_binary', { path: resolvedPath });
        return new Uint8Array(result);
      },
      writeFile: async (relativePath: string, data: Uint8Array): Promise<void> => {
        requirePermission('fs.write');
        const resolvedPath = await context.resolveStoragePath(relativePath);
        await invokeAsExtension<void>(context.extensionId, 'write_file_binary', {
          path: resolvedPath,
          data: Array.from(data),
        });
      },
      readDir: async (relativePath = ''): Promise<ExtensionDirEntry[]> => {
        requirePermission('fs.read');
        const resolvedPath = relativePath.trim().length > 0
          ? await context.resolveStoragePath(relativePath)
          : await context.getExtensionStoragePath();
        return invokeAsExtension<ExtensionDirEntry[]>(context.extensionId, 'read_dir', { path: resolvedPath });
      },
      exists: async (relativePath: string): Promise<boolean> => {
        requirePermission('fs.read');
        const resolvedPath = await context.resolveStoragePath(relativePath);
        return invokeAsExtension<boolean>(context.extensionId, 'path_exists', { path: resolvedPath });
      },
      resolvePath: async (relativePath: string): Promise<string> => {
        return context.resolveStoragePath(relativePath);
      },
      importFile: async (sourcePath: string, targetRelativePath: string): Promise<string> => {
        requirePermission('fs.read');
        requirePermission('fs.write');

        if (!await context.isInAllowedReadDir(sourcePath)) {
          throw new Error(`Access denied: ${sourcePath} is not in allowed directories`);
        }

        return invokeAsExtension<string>(context.extensionId, 'import_extension_storage_file', {
          extensionId: context.extensionId,
          sourcePath,
          targetRelativePath: context.normalizeRelativePath(targetRelativePath),
        });
      },
      deleteFile: async (relativePath: string): Promise<void> => {
        requirePermission('fs.write');
        const resolvedPath = await context.resolveStoragePath(relativePath);
        await invokeAsExtension<void>(context.extensionId, 'delete_file_binary', { path: resolvedPath });
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
        await requireScopedReadAccess(path);
        const result = await invokeAsExtension<number[]>(context.extensionId, 'read_file_binary', { path });
        return new Uint8Array(result);
      },
      writeFile: async (path: string, data: Uint8Array): Promise<void> => {
        await requireScopedWriteAccess(path);
        await invokeAsExtension<void>(context.extensionId, 'write_file_binary', {
          path,
          data: Array.from(data),
        });
      },
      readDir: async (path: string): Promise<ExtensionDirEntry[]> => {
        await requireScopedReadAccess(path);
        return invokeAsExtension<ExtensionDirEntry[]>(context.extensionId, 'read_dir', { path });
      },
      exists: async (path: string): Promise<boolean> => {
        await requireScopedReadAccess(path);
        return invokeAsExtension<boolean>(context.extensionId, 'path_exists', { path });
      },
    },
  };
}
