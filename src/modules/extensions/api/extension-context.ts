// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { i18n } from '@/localization';
import type { ExtensionPermission } from '@/types/extension';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { getPlatformInfo } from '@/modules/extensions/api/platform';

export type ExtensionContext = {
  extensionId: string;
  hasPermission: (permission: ExtensionPermission) => boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  getExtensionPath: () => Promise<string>;
  getExtensionStoragePath: () => Promise<string>;
  isPathWithinDirectory: (path: string, directory: string) => Promise<boolean>;
  isInExtensionDir: (path: string) => Promise<boolean>;
  getSharedBinariesDir: () => Promise<string>;
  isInSharedBinariesDir: (path: string) => Promise<boolean>;
  isInAllowedReadDir: (path: string) => Promise<boolean>;
  normalizeRelativePath: (relativePath: string) => string;
  resolvePrivatePath: (relativePath: string) => Promise<string>;
  resolveStoragePath: (relativePath: string) => Promise<string>;
  getExtensionName: () => string;
  getExtensionIconPath: () => string | undefined;
  getExtensionToastTitle: () => string;
};

export function createExtensionContext(
  extensionId: string,
  permissions: ExtensionPermission[],
): ExtensionContext {
  function hasPermission(permission: ExtensionPermission): boolean {
    return permissions.includes(permission);
  }

  function t(key: string, params?: Record<string, string | number>): string {
    return i18n.global.t(key, params as Record<string, unknown>);
  }

  let extensionPathPromise: Promise<string> | null = null;

  async function getExtensionPath(): Promise<string> {
    if (!extensionPathPromise) {
      extensionPathPromise = invoke<string>('get_extension_path', { extensionId });
    }

    return extensionPathPromise;
  }

  let extensionStoragePathPromise: Promise<string> | null = null;

  async function getExtensionStoragePath(): Promise<string> {
    if (!extensionStoragePathPromise) {
      extensionStoragePathPromise = invoke<string>('get_extension_storage_path', { extensionId });
    }

    return extensionStoragePathPromise;
  }

  async function isPathWithinDirectory(path: string, directory: string): Promise<boolean> {
    try {
      return await invoke<boolean>('is_path_within_directory', {
        path,
        directory,
      });
    }
    catch {
      return false;
    }
  }

  async function isInExtensionDir(path: string): Promise<boolean> {
    const extensionPath = await getExtensionPath();
    return isPathWithinDirectory(path, extensionPath);
  }

  let sharedBinariesDirPromise: Promise<string> | null = null;

  async function getSharedBinariesDir(): Promise<string> {
    if (!sharedBinariesDirPromise) {
      sharedBinariesDirPromise = invoke<string>('get_shared_binaries_base_dir');
    }

    return sharedBinariesDirPromise;
  }

  async function isInSharedBinariesDir(path: string): Promise<boolean> {
    const sharedDir = await getSharedBinariesDir();
    return isPathWithinDirectory(path, sharedDir);
  }

  async function isInAllowedReadDir(path: string): Promise<boolean> {
    if (await isInExtensionDir(path)) return true;
    if (await isInSharedBinariesDir(path)) return true;
    const storageStore = useExtensionsStorageStore();
    return storageStore.hasScopedAccess(extensionId, path, 'read');
  }

  function normalizeRelativePath(relativePath: string): string {
    const trimmedPath = relativePath.trim();

    if (trimmedPath.length === 0) {
      throw new Error('Path cannot be empty');
    }

    if (/^[A-Za-z]:[\\/]/.test(trimmedPath) || trimmedPath.startsWith('/') || trimmedPath.startsWith('\\')) {
      throw new Error('Private fs methods require a relative path');
    }

    const pathSegments = trimmedPath
      .split(/[\\/]+/)
      .filter(segment => segment.length > 0);

    if (pathSegments.some(segment => segment === '.' || segment === '..')) {
      throw new Error('Private fs path cannot contain "." or ".." segments');
    }

    return pathSegments.join('/');
  }

  async function resolvePrivatePath(relativePath: string): Promise<string> {
    const normalizedRelativePath = normalizeRelativePath(relativePath);
    const extensionPath = await getExtensionPath();
    const pathSeparator = getPlatformInfo().pathSeparator;

    if (extensionPath.endsWith('/') || extensionPath.endsWith('\\')) {
      return `${extensionPath}${normalizedRelativePath}`;
    }

    return `${extensionPath}${pathSeparator}${normalizedRelativePath}`;
  }

  async function resolveStoragePath(relativePath: string): Promise<string> {
    const normalizedRelativePath = normalizeRelativePath(relativePath);
    const storagePath = await getExtensionStoragePath();
    const pathSeparator = getPlatformInfo().pathSeparator;

    if (storagePath.endsWith('/') || storagePath.endsWith('\\')) {
      return `${storagePath}${normalizedRelativePath}`;
    }

    return `${storagePath}${pathSeparator}${normalizedRelativePath}`;
  }

  function getExtensionName(): string {
    const storageStore = useExtensionsStorageStore();
    const installedExtension = storageStore.extensionsData.installedExtensions[extensionId];
    const manifestName = installedExtension?.manifest?.name;
    return typeof manifestName === 'string' && manifestName.trim().length > 0
      ? manifestName.trim()
      : extensionId.split('.').pop() || extensionId;
  }

  function getExtensionIconPath(): string | undefined {
    const storageStore = useExtensionsStorageStore();
    const installedExtension = storageStore.extensionsData.installedExtensions[extensionId];
    const manifestIcon = installedExtension?.manifest?.icon;

    if (typeof manifestIcon === 'string' && manifestIcon.trim().length > 0) {
      return manifestIcon.trim();
    }

    return undefined;
  }

  function getExtensionToastTitle(): string {
    return `${t('extension')} | ${getExtensionName()}`;
  }

  return {
    extensionId,
    hasPermission,
    t,
    getExtensionPath,
    getExtensionStoragePath,
    isPathWithinDirectory,
    isInExtensionDir,
    getSharedBinariesDir,
    isInSharedBinariesDir,
    isInAllowedReadDir,
    normalizeRelativePath,
    resolvePrivatePath,
    resolveStoragePath,
    getExtensionName,
    getExtensionIconPath,
    getExtensionToastTitle,
  };
}
