// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'vue-sonner';
import { createApp, markRaw, ref, type Ref } from 'vue';
import type { SigmaExtensionAPI } from '@sigma-file-manager/api';
import { CustomProgress } from '@/components/ui/toaster';
import { i18n } from '@/localization';
import { messages as appMessages } from '@/localization/data';
import type {
  ExtensionPermission,
  Disposable,
  ExtensionContextMenuItem,
  ExtensionSidebarItem,
  ExtensionToolbarDropdown,
  ExtensionCommand,
  ContextMenuContext,
  NotificationOptions,
  DialogOptions,
  DialogResult,
  ExtensionDirEntry,
  ExtensionConfiguration,
  ProgressOptions,
  ProgressReport,
  Progress,
  CancellationToken,
  ExtensionKeybinding,
  ExtensionKeybindingWhen,
  ExtensionScopedDirectory,
  PlatformOS,
  PlatformArch,
  PlatformInfo,
  BinaryInstallOptions,
  BinaryInfo,
  SharedBinaryInfo,
  UIElement,
  UISelectOption,
  ModalOptions,
  ModalHandle,
} from '@/types/extension';
import { createModal } from '@/modules/extensions/api/modal-state';
import ExtensionToolbarView from '@/modules/extensions/components/extension-toolbar-view.vue';
import type { ShortcutKeys } from '@/types/user-settings';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { freezeObject } from '@/modules/extensions/runtime/sandbox';
import { getBinaryLookupVersion } from '@/modules/extensions/utils/binary-metadata';
import { getSharedBinaryPendingKey } from '@/modules/extensions/utils/shared-binary';
import { fetchGitHubTags, getGitHubRepoInfo, parseVersionFromTag } from '@/data/extensions';
import {
  getBuiltinCommandHandler,
  isBuiltinCommand,
  getBuiltinCommandDefinitions,
  type OpenFileDialogOptions,
  type SaveFileDialogOptions,
} from '@/modules/extensions/builtin-commands';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  clearExtensionContextListeners,
  getCurrentPath,
  getSelectedEntries,
  getAppVersion,
  getDownloadsDir,
  getPicturesDir,
  onPathChange,
  onSelectionChange,
  type ExtensionContextEntry,
} from '@/modules/extensions/context';

export type { SigmaExtensionAPI } from '@sigma-file-manager/api';

let platformInfo: PlatformInfo | null = null;
let platformInfoPromise: Promise<void> | null = null;

export async function initPlatformInfo(): Promise<void> {
  if (platformInfo) return;
  if (platformInfoPromise) return platformInfoPromise;

  platformInfoPromise = (async () => {
    const info = await invoke<{ os: string;
      arch: string; }>('get_platform_info');
    const os = info.os as PlatformOS;

    platformInfo = {
      os,
      arch: info.arch as PlatformArch,
      pathSeparator: os === 'windows' ? '\\' : '/',
      isWindows: os === 'windows',
      isMacos: os === 'macos',
      isLinux: os === 'linux',
    };
  })();

  return platformInfoPromise;
}

export function getPlatformInfo(): PlatformInfo {
  if (!platformInfo) {
    console.warn('[Extensions API] Platform info accessed before initialization, using defaults');
    return {
      os: 'linux',
      arch: 'x64',
      pathSeparator: '/',
      isWindows: false,
      isMacos: false,
      isLinux: true,
    };
  }

  return platformInfo;
}

function t(key: string, params?: Record<string, string | number>): string {
  return i18n.global.t(key, params as Record<string, unknown>);
}

export async function ensurePlatformInfo(): Promise<PlatformInfo> {
  if (!platformInfo) {
    await initPlatformInfo();
  }

  return platformInfo!;
}

type ExtensionDialogState = {
  isOpen: boolean;
  options: DialogOptions | null;
  resolve: ((result: DialogResult) => void) | null;
};

export const extensionDialogState: Ref<ExtensionDialogState> = ref({
  isOpen: false,
  options: null,
  resolve: null,
});

export function showExtensionDialog(options: DialogOptions): Promise<DialogResult> {
  return new Promise((resolve) => {
    extensionDialogState.value = {
      isOpen: true,
      options,
      resolve,
    };
  });
}

export function closeExtensionDialog(result: DialogResult): void {
  const resolveCallback = extensionDialogState.value.resolve;
  extensionDialogState.value = {
    isOpen: false,
    options: null,
    resolve: null,
  };

  if (resolveCallback) {
    resolveCallback(result);
  }
}

export type SettingsChangeCallback = (newValue: unknown, oldValue: unknown) => void;

type ContextMenuRegistration = {
  extensionId: string;
  item: ExtensionContextMenuItem;
  handler: (context: ContextMenuContext) => Promise<void> | void;
};

type SidebarRegistration = {
  extensionId: string;
  page: ExtensionSidebarItem;
};

type ToolbarRegistration = {
  extensionId: string;
  dropdown: ExtensionToolbarDropdown;
  handlers: Record<string, () => Promise<void> | void>;
};

type CommandRegistration = {
  extensionId: string;
  command: ExtensionCommand;
  handler: (...args: unknown[]) => Promise<unknown> | unknown;
};

type KeybindingRegistration = {
  extensionId: string;
  commandId: string;
  keys: ShortcutKeys;
  when?: ExtensionKeybindingWhen;
};

const contextMenuRegistrations: ContextMenuRegistration[] = [];
const sidebarRegistrations: SidebarRegistration[] = [];
const toolbarRegistrations: ToolbarRegistration[] = [];
const commandRegistrations: CommandRegistration[] = [];
const keybindingRegistrations: KeybindingRegistration[] = [];

type KeybindingConflictChecker = (keys: ShortcutKeys) => boolean;
let appKeybindingConflictChecker: KeybindingConflictChecker | null = null;

export function setAppKeybindingConflictChecker(checker: KeybindingConflictChecker): void {
  appKeybindingConflictChecker = checker;
}

function hasConflictWithAppShortcuts(keys: ShortcutKeys): boolean {
  if (!appKeybindingConflictChecker) return false;
  return appKeybindingConflictChecker(keys);
}

function hasConflictWithOtherExtensions(keys: ShortcutKeys): boolean {
  return keybindingRegistrations.some((registration) => {
    return (
      registration.keys.key.toLowerCase() === keys.key.toLowerCase()
      && (registration.keys.ctrl || false) === (keys.ctrl || false)
      && (registration.keys.alt || false) === (keys.alt || false)
      && (registration.keys.shift || false) === (keys.shift || false)
      && (registration.keys.meta || false) === (keys.meta || false)
    );
  });
}

type SharedBinaryInstallResult = {
  path: string;
  version?: string;
  storageVersion?: string | null;
  repository?: string;
  latestVersion?: string;
  hasUpdate?: boolean;
  latestCheckedAt?: number;
  installedAt: number;
};

const pendingBinaryDownloads = new Map<string, Promise<SharedBinaryInstallResult>>();

type SettingsChangeListener = {
  extensionId: string;
  key: string;
  callback: SettingsChangeCallback;
};

const settingsChangeListeners: SettingsChangeListener[] = [];
const extensionConfigurations: Map<string, ExtensionConfiguration> = new Map();

export function registerExtensionConfiguration(extensionId: string, configuration: ExtensionConfiguration): void {
  extensionConfigurations.set(extensionId, configuration);
}

export function getExtensionConfiguration(extensionId: string): ExtensionConfiguration | undefined {
  return extensionConfigurations.get(extensionId);
}

export function getAllExtensionConfigurations(): Map<string, ExtensionConfiguration> {
  return new Map(extensionConfigurations);
}

export async function notifySettingsChange(
  extensionId: string,
  key: string,
  newValue: unknown,
  oldValue: unknown,
): Promise<void> {
  const listeners = settingsChangeListeners.filter(
    listener => listener.extensionId === extensionId && listener.key === key,
  );

  for (const listener of listeners) {
    try {
      listener.callback(newValue, oldValue);
    }
    catch (error) {
      console.error(`Settings change listener error for ${extensionId}.${key}:`, error);
    }
  }
}

export function getContextMenuRegistrations(): ContextMenuRegistration[] {
  return [...contextMenuRegistrations];
}

export function getSidebarRegistrations(): SidebarRegistration[] {
  return [...sidebarRegistrations];
}

export function getToolbarRegistrations(): ToolbarRegistration[] {
  return [...toolbarRegistrations];
}

export function getCommandRegistrations(): CommandRegistration[] {
  return [...commandRegistrations];
}

export function getKeybindingRegistrations(): KeybindingRegistration[] {
  return [...keybindingRegistrations];
}

export function parseKeybindingString(keyString: string): ShortcutKeys {
  const parts = keyString.toLowerCase().split('+').map(part => part.trim());
  const keys: ShortcutKeys = { key: '' };

  for (let partIndex = 0; partIndex < parts.length; partIndex++) {
    const part = parts[partIndex];

    if (part === 'ctrl' || part === 'control') {
      keys.ctrl = true;
    }
    else if (part === 'alt') {
      keys.alt = true;
    }
    else if (part === 'shift') {
      keys.shift = true;
    }
    else if (part === 'meta' || part === 'cmd' || part === 'win') {
      keys.meta = true;
    }
    else {
      keys.key = part.length === 1 ? part : part.charAt(0).toUpperCase() + part.slice(1);
    }
  }

  return keys;
}

export function formatKeybindingKeys(keys: ShortcutKeys): string {
  return getKeybindingParts(keys).join('+');
}

export function getKeybindingParts(keys: ShortcutKeys): string[] {
  const parts: string[] = [];

  if (keys.ctrl) parts.push('Ctrl');
  if (keys.alt) parts.push('Alt');
  if (keys.shift) parts.push('Shift');
  if (keys.meta) parts.push('Meta');

  let keyDisplay = keys.key;

  if (keyDisplay.length === 1) {
    keyDisplay = keyDisplay.toUpperCase();
  }

  if (keyDisplay === 'Enter') {
    keyDisplay = '↵';
  }

  parts.push(keyDisplay);
  return parts;
}

export function registerExtensionKeybindings(extensionId: string, keybindings: ExtensionKeybinding[]): void {
  for (const keybinding of keybindings) {
    const commandId = `${extensionId}.${keybinding.command}`;
    const keys = parseKeybindingString(keybinding.key);

    if (hasConflictWithAppShortcuts(keys)) {
      console.warn(
        `[Extensions] Skipping keybinding "${keybinding.key}" for "${commandId}" - conflicts with app shortcut`,
      );
      keybindingRegistrations.push({
        extensionId,
        commandId,
        keys: { key: '' },
        when: keybinding.when,
      });
      continue;
    }

    if (hasConflictWithOtherExtensions(keys)) {
      console.warn(
        `[Extensions] Skipping keybinding "${keybinding.key}" for "${commandId}" - conflicts with another extension`,
      );
      keybindingRegistrations.push({
        extensionId,
        commandId,
        keys: { key: '' },
        when: keybinding.when,
      });
      continue;
    }

    keybindingRegistrations.push({
      extensionId,
      commandId,
      keys,
      when: keybinding.when,
    });
  }
}

export function getKeybindingForCommand(commandId: string): KeybindingRegistration | undefined {
  return keybindingRegistrations.find(registration => registration.commandId === commandId);
}

export function getKeybindingForContextMenuItem(extensionId: string, contextMenuId: string): KeybindingRegistration | undefined {
  const commandId = `${extensionId}.${contextMenuId}`;
  return keybindingRegistrations.find(registration => registration.commandId === commandId);
}

const binaryDownloadCounts = new Map<string, number>();

export function getBinaryDownloadCount(extensionId: string): number {
  return binaryDownloadCounts.get(extensionId) ?? 0;
}

export function clearBinaryDownloadCount(extensionId: string): void {
  binaryDownloadCounts.delete(extensionId);
}

export function createExtensionAPI(
  extensionId: string,
  permissions: ExtensionPermission[],
): SigmaExtensionAPI {
  function hasPermission(permission: ExtensionPermission): boolean {
    return permissions.includes(permission);
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

  const contextMenuAPI = {
    registerItem: (
      item: ExtensionContextMenuItem,
      handler: (context: ContextMenuContext) => Promise<void> | void,
    ): Disposable => {
      if (!hasPermission('contextMenu')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'contextMenu' }));
      }

      const registration: ContextMenuRegistration = {
        extensionId,
        item: {
          ...item,
          id: `${extensionId}.${item.id}`,
        },
        handler,
      };

      contextMenuRegistrations.push(registration);

      return {
        dispose: () => {
          const index = contextMenuRegistrations.indexOf(registration);

          if (index !== -1) {
            contextMenuRegistrations.splice(index, 1);
          }
        },
      };
    },
  };

  const sidebarAPI = {
    registerPage: (page: ExtensionSidebarItem): Disposable => {
      if (!hasPermission('sidebar')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'sidebar' }));
      }

      const registration: SidebarRegistration = {
        extensionId,
        page: {
          ...page,
          id: `${extensionId}.${page.id}`,
        },
      };

      sidebarRegistrations.push(registration);

      return {
        dispose: () => {
          const index = sidebarRegistrations.indexOf(registration);

          if (index !== -1) {
            sidebarRegistrations.splice(index, 1);
          }
        },
      };
    },
  };

  const toolbarAPI = {
    registerDropdown: (
      dropdown: ExtensionToolbarDropdown,
      handlers: Record<string, () => Promise<void> | void>,
    ): Disposable => {
      if (!hasPermission('toolbar')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'toolbar' }));
      }

      const registration: ToolbarRegistration = {
        extensionId,
        dropdown: {
          ...dropdown,
          id: `${extensionId}.${dropdown.id}`,
          items: dropdown.items.map(item => ({
            ...item,
            id: `${extensionId}.${item.id}`,
          })),
        },
        handlers: Object.fromEntries(
          Object.entries(handlers).map(([key, value]) => [`${extensionId}.${key}`, value]),
        ),
      };

      toolbarRegistrations.push(registration);

      return {
        dispose: () => {
          const index = toolbarRegistrations.indexOf(registration);

          if (index !== -1) {
            toolbarRegistrations.splice(index, 1);
          }
        },
      };
    },
  };

  const commandsAPI = {
    registerCommand: (
      command: ExtensionCommand,
      handler: (...args: unknown[]) => Promise<unknown> | unknown,
    ): Disposable => {
      if (!hasPermission('commands')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'commands' }));
      }

      const registration: CommandRegistration = {
        extensionId,
        command: {
          ...command,
          id: `${extensionId}.${command.id}`,
        },
        handler,
      };

      commandRegistrations.push(registration);

      return {
        dispose: () => {
          const index = commandRegistrations.indexOf(registration);

          if (index !== -1) {
            commandRegistrations.splice(index, 1);
          }
        },
      };
    },
    executeCommand: async (commandId: string, ...args: unknown[]): Promise<unknown> => {
      if (isBuiltinCommand(commandId)) {
        if (commandId.startsWith('sigma.shell.') && !hasPermission('shell')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'shell' }));
        }

        const handler = getBuiltinCommandHandler(commandId);

        if (!handler) {
          throw new Error(`Built-in command not found: ${commandId}`);
        }

        return handler(...args);
      }

      const fullCommandId = commandId.includes('.') ? commandId : `${extensionId}.${commandId}`;
      const registration = commandRegistrations.find(
        reg => reg.command.id === fullCommandId,
      );

      if (!registration) {
        throw new Error(`Command not found: ${fullCommandId}`);
      }

      return registration.handler(...args);
    },
    getBuiltinCommands: () => {
      return getBuiltinCommandDefinitions().map(cmd => ({
        id: cmd.id,
        title: cmd.title,
        description: cmd.description,
      }));
    },
  };

  const contextAPI = {
    getCurrentPath: () => getCurrentPath(),
    getSelectedEntries: () => getSelectedEntries(),
    getAppVersion: () => getAppVersion(),
    getDownloadsDir: () => getDownloadsDir(),
    getPicturesDir: () => getPicturesDir(),
    openUrl: (url: string) => openUrl(url),
    onPathChange: (callback: (path: string | null) => void): Disposable => {
      return onPathChange(extensionId, callback);
    },
    onSelectionChange: (callback: (entries: ExtensionContextEntry[]) => void): Disposable => {
      return onSelectionChange(extensionId, callback);
    },
  };

  const dialogAPI = {
    openFile: async (options?: OpenFileDialogOptions): Promise<string | string[] | null> => {
      if (!hasPermission('dialogs')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'dialogs' }));
      }

      return commandsAPI.executeCommand('sigma.dialog.openFile', options) as Promise<string | string[] | null>;
    },
    saveFile: async (options?: SaveFileDialogOptions): Promise<string | null> => {
      if (!hasPermission('dialogs')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'dialogs' }));
      }

      return commandsAPI.executeCommand('sigma.dialog.saveFile', options) as Promise<string | null>;
    },
  };

  const shellAPI = {
    run: async (commandPath: string, args?: string[]): Promise<{ code: number;
      stdout: string;
      stderr: string; }> => {
      if (!hasPermission('shell')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'shell' }));
      }

      return invoke<{ code: number;
        stdout: string;
        stderr: string; }>('run_extension_command', {
        extensionId,
        commandPath,
        args: args || [],
      });
    },
    runWithProgress: async (
      commandPath: string,
      args?: string[],
      onProgress?: (payload: { taskId: string;
        line: string;
        isStderr: boolean; }) => void,
    ): Promise<{
      taskId: string;
      result: Promise<{ code: number;
        stdout: string;
        stderr: string; }>;
      cancel: () => Promise<void>;
    }> => {
      if (!hasPermission('shell')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'shell' }));
      }

      const taskId = await invoke<string>('start_extension_command', {
        extensionId,
        commandPath,
        args: args || [],
      });

      let resolveResult: ((value: { code: number;
        stdout: string;
        stderr: string; }) => void) | null = null;
      let rejectResult: ((reason?: unknown) => void) | null = null;

      const resultPromise = new Promise<{ code: number;
        stdout: string;
        stderr: string; }>((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
      });

      const unlistenProgress = await listen<{
        taskId: string;
        line: string;
        isStderr: boolean;
      }>('extension-command-progress', (event) => {
        if (event.payload.taskId !== taskId) return;
        if (onProgress) onProgress(event.payload);
      });

      const unlistenComplete = await listen<{
        taskId: string;
        code: number;
        stdout: string;
        stderr: string;
      }>('extension-command-complete', (event) => {
        if (event.payload.taskId !== taskId) return;
        unlistenProgress();
        unlistenComplete();

        if (resolveResult) {
          resolveResult({
            code: event.payload.code,
            stdout: event.payload.stdout,
            stderr: event.payload.stderr,
          });
        }
      });

      async function cancel(): Promise<void> {
        try {
          await invoke('cancel_extension_command', { taskId });
        }
        catch (error) {
          if (rejectResult) rejectResult(error);
        }
      }

      return {
        taskId,
        result: resultPromise,
        cancel,
      };
    },
    renamePartFilesToTs: async (directory: string): Promise<number> => {
      if (!hasPermission('shell')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'shell' }));
      }

      return invoke<number>('rename_part_files_to_ts', { directory });
    },
  };

  const fsAPI = {
    readFile: async (path: string): Promise<Uint8Array> => {
      if (!hasPermission('fs.read')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
      }

      if (!await isInAllowedReadDir(path)) {
        throw new Error(`Access denied: ${path} is not in scoped directories`);
      }

      const result = await invoke<number[]>('read_file_binary', { path });
      return new Uint8Array(result);
    },
    writeFile: async (path: string, data: Uint8Array): Promise<void> => {
      if (!hasPermission('fs.write')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.write' }));
      }

      const storageStore = useExtensionsStorageStore();

      if (!await isInExtensionDir(path) && !await storageStore.hasScopedAccess(extensionId, path, 'write')) {
        throw new Error(`Access denied: ${path} is not in scoped directories`);
      }

      await invoke('write_file_binary', {
        path,
        data: Array.from(data),
      });
    },
    readDir: async (path: string): Promise<ExtensionDirEntry[]> => {
      if (!hasPermission('fs.read')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
      }

      if (!await isInAllowedReadDir(path)) {
        throw new Error(`Access denied: ${path} is not in scoped directories`);
      }

      const result = await invoke<ExtensionDirEntry[]>('read_dir', { path });
      return result;
    },
    exists: async (path: string): Promise<boolean> => {
      if (!hasPermission('fs.read')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
      }

      if (!await isInAllowedReadDir(path)) {
        throw new Error(`Access denied: ${path} is not in scoped directories`);
      }

      return invoke<boolean>('path_exists', { path });
    },
    downloadFile: async (url: string, path: string): Promise<void> => {
      if (!hasPermission('fs.write')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.write' }));
      }

      if (!await isInExtensionDir(path)) {
        throw new Error(`Access denied: ${path} is not in extension directory`);
      }

      await invoke('download_extension_file', {
        extensionId,
        filePath: path,
        url,
        integrity: null,
      });
    },
    private: {
      readFile: async (relativePath: string): Promise<Uint8Array> => {
        if (!hasPermission('fs.read')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const resolvedPath = await resolvePrivatePath(relativePath);
        const result = await invoke<number[]>('read_file_binary', { path: resolvedPath });
        return new Uint8Array(result);
      },
      writeFile: async (relativePath: string, data: Uint8Array): Promise<void> => {
        if (!hasPermission('fs.write')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.write' }));
        }

        const resolvedPath = await resolvePrivatePath(relativePath);
        await invoke('write_file_binary', {
          path: resolvedPath,
          data: Array.from(data),
        });
      },
      readDir: async (relativePath = ''): Promise<ExtensionDirEntry[]> => {
        if (!hasPermission('fs.read')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const resolvedPath = relativePath.trim().length > 0
          ? await resolvePrivatePath(relativePath)
          : await getExtensionPath();
        return invoke<ExtensionDirEntry[]>('read_dir', { path: resolvedPath });
      },
      exists: async (relativePath: string): Promise<boolean> => {
        if (!hasPermission('fs.read')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const resolvedPath = await resolvePrivatePath(relativePath);
        return invoke<boolean>('path_exists', { path: resolvedPath });
      },
      resolvePath: async (relativePath: string): Promise<string> => {
        return resolvePrivatePath(relativePath);
      },
    },
    storage: {
      readFile: async (relativePath: string): Promise<Uint8Array> => {
        if (!hasPermission('fs.read')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const resolvedPath = await resolveStoragePath(relativePath);
        const result = await invoke<number[]>('read_file_binary', { path: resolvedPath });
        return new Uint8Array(result);
      },
      writeFile: async (relativePath: string, data: Uint8Array): Promise<void> => {
        if (!hasPermission('fs.write')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.write' }));
        }

        const resolvedPath = await resolveStoragePath(relativePath);
        await invoke('write_file_binary', {
          path: resolvedPath,
          data: Array.from(data),
        });
      },
      readDir: async (relativePath = ''): Promise<ExtensionDirEntry[]> => {
        if (!hasPermission('fs.read')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const resolvedPath = relativePath.trim().length > 0
          ? await resolveStoragePath(relativePath)
          : await getExtensionStoragePath();
        return invoke<ExtensionDirEntry[]>('read_dir', { path: resolvedPath });
      },
      exists: async (relativePath: string): Promise<boolean> => {
        if (!hasPermission('fs.read')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const resolvedPath = await resolveStoragePath(relativePath);
        return invoke<boolean>('path_exists', { path: resolvedPath });
      },
      resolvePath: async (relativePath: string): Promise<string> => {
        return resolveStoragePath(relativePath);
      },
      importFile: async (sourcePath: string, targetRelativePath: string): Promise<string> => {
        if (!hasPermission('fs.read')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        if (!hasPermission('fs.write')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.write' }));
        }

        return invoke<string>('import_extension_storage_file', {
          extensionId,
          sourcePath,
          targetRelativePath: normalizeRelativePath(targetRelativePath),
        });
      },
      deleteFile: async (relativePath: string): Promise<void> => {
        if (!hasPermission('fs.write')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.write' }));
        }

        const resolvedPath = await resolveStoragePath(relativePath);
        await invoke('delete_file_binary', { path: resolvedPath });
      },
    },
    scoped: {
      requestDirectoryAccess: async (options?: { permission?: 'read' | 'write' | 'readWrite';
        title?: string;
        defaultPath?: string; }): Promise<{ granted: boolean;
          path?: string;
          permissions?: ('read' | 'write')[]; }> => {
        const requestedPermission = options?.permission ?? 'read';

        if ((requestedPermission === 'read' || requestedPermission === 'readWrite') && !hasPermission('fs.read')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        if ((requestedPermission === 'write' || requestedPermission === 'readWrite') && !hasPermission('fs.write')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.write' }));
        }

        if (!hasPermission('dialogs')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'dialogs' }));
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

        await storageStore.addScopedDirectory(extensionId, {
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
        const extensionSettings = await storageStore.getExtensionSettings(extensionId);
        return extensionSettings?.scopedDirectories ?? [];
      },
      readFile: async (path: string): Promise<Uint8Array> => {
        if (!hasPermission('fs.read')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const storageStore = useExtensionsStorageStore();

        if (!await storageStore.hasScopedAccess(extensionId, path, 'read')) {
          throw new Error(`Access denied: ${path} is not in scoped directories`);
        }

        const result = await invoke<number[]>('read_file_binary', { path });
        return new Uint8Array(result);
      },
      writeFile: async (path: string, data: Uint8Array): Promise<void> => {
        if (!hasPermission('fs.write')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.write' }));
        }

        const storageStore = useExtensionsStorageStore();

        if (!await storageStore.hasScopedAccess(extensionId, path, 'write')) {
          throw new Error(`Access denied: ${path} is not in scoped directories`);
        }

        await invoke('write_file_binary', {
          path,
          data: Array.from(data),
        });
      },
      readDir: async (path: string): Promise<ExtensionDirEntry[]> => {
        if (!hasPermission('fs.read')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const storageStore = useExtensionsStorageStore();

        if (!await storageStore.hasScopedAccess(extensionId, path, 'read')) {
          throw new Error(`Access denied: ${path} is not in scoped directories`);
        }

        return invoke<ExtensionDirEntry[]>('read_dir', { path });
      },
      exists: async (path: string): Promise<boolean> => {
        if (!hasPermission('fs.read')) {
          throw new Error(t('extensions.api.permissionDenied', { permission: 'fs.read' }));
        }

        const storageStore = useExtensionsStorageStore();

        if (!await storageStore.hasScopedAccess(extensionId, path, 'read')) {
          throw new Error(`Access denied: ${path} is not in scoped directories`);
        }

        return invoke<boolean>('path_exists', { path });
      },
    },
  };

  const uiAPI = {
    showNotification: (options: NotificationOptions): void => {
      if (!hasPermission('notifications')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'notifications' }));
      }

      const toastId = `ext-notification-${extensionId}-${Date.now()}`;

      toast.custom(markRaw(CustomProgress), {
        id: toastId,
        duration: options.duration || 4000,
        componentProps: {
          data: {
            id: toastId,
            title: getExtensionToastTitle(),
            subtitle: options.subtitle || '',
            description: options.description || '',
            progress: 0,
            timer: 0,
            actionText: '',
            cleanup: () => {},
            extensionId,
            extensionIconPath: getExtensionIconPath(),
          },
        },
      });
    },
    showDialog: async (options: DialogOptions): Promise<DialogResult> => {
      if (!hasPermission('dialogs')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'dialogs' }));
      }

      return showExtensionDialog(options);
    },
    withProgress: async <T>(
      options: ProgressOptions,
      task: (progress: Progress, token: CancellationToken) => Promise<T>,
    ): Promise<T> => {
      if (!hasPermission('notifications')) {
        throw new Error(t('extensions.api.permissionDenied', { permission: 'notifications' }));
      }

      let currentProgress = 0;
      let currentSubtitle = options.subtitle;
      let currentDescription = '';
      let isCancelled = false;
      let isCompleted = false;
      const cancellationListeners: (() => void)[] = [];

      const toastId = `progress-${extensionId}-${Date.now()}`;

      function updateToast(): void {
        toast.custom(markRaw(CustomProgress), {
          id: toastId,
          duration: Infinity,
          componentProps: {
            data: {
              id: toastId,
              title: getExtensionToastTitle(),
              subtitle: currentSubtitle,
              description: currentDescription,
              progress: Math.round(currentProgress),
              timer: 0,
              actionText: isCompleted ? '' : (options.cancellable ? t('extensions.api.stop') : t('extensions.api.dismiss')),
              cleanup: () => {
                if (options.cancellable) {
                  isCancelled = true;
                  isCompleted = true;
                  updateToast();
                  cancellationListeners.forEach(listener => listener());
                }
                else {
                  toast.dismiss(toastId);
                }
              },
              extensionId,
              extensionIconPath: getExtensionIconPath(),
            },
          },
        });
      }

      const progress: Progress = {
        report: (value: ProgressReport): void => {
          if (isCancelled && (value.increment !== undefined || value.value !== undefined)) {
            return;
          }

          if (value.subtitle !== undefined) {
            currentSubtitle = value.subtitle;
          }

          if (value.description !== undefined) {
            currentDescription = value.description;
          }

          if (value.value !== undefined && Number.isFinite(value.value)) {
            currentProgress = Math.max(0, Math.min(100, value.value));
          }
          else if (value.increment !== undefined) {
            currentProgress = Math.min(100, currentProgress + value.increment);
          }

          updateToast();
        },
      };

      const token: CancellationToken = {
        get isCancellationRequested() {
          return isCancelled;
        },
        onCancellationRequested: (listener: () => void): Disposable => {
          cancellationListeners.push(listener);
          return {
            dispose: () => {
              const listenerIndex = cancellationListeners.indexOf(listener);

              if (listenerIndex !== -1) {
                cancellationListeners.splice(listenerIndex, 1);
              }
            },
          };
        },
      };

      updateToast();

      const DISMISS_DELAY = 2000;

      const CANCELLED_DISMISS_DELAY = 1500;

      try {
        const result = await task(progress, token);

        if (isCancelled) {
          await new Promise(resolve => setTimeout(resolve, CANCELLED_DISMISS_DELAY));
          toast.dismiss(toastId);
          return result;
        }

        isCompleted = true;
        updateToast();
        await new Promise(resolve => setTimeout(resolve, DISMISS_DELAY));
        toast.dismiss(toastId);
        return result;
      }
      catch (error) {
        toast.dismiss(toastId);
        throw error;
      }
    },
    createModal: (options: ModalOptions): ModalHandle => {
      return createModal(extensionId, options);
    },
    input: (options: { id: string;
      label?: string;
      placeholder?: string;
      value?: string;
      disabled?: boolean; }): UIElement => {
      return {
        type: 'input',
        ...options,
      };
    },
    select: (options: { id: string;
      label?: string;
      placeholder?: string;
      options: UISelectOption[];
      value?: string;
      disabled?: boolean; }): UIElement => {
      return {
        type: 'select',
        ...options,
      };
    },
    checkbox: (options: { id: string;
      label?: string;
      checked?: boolean;
      disabled?: boolean; }): UIElement => {
      return {
        type: 'checkbox',
        value: options.checked,
        ...options,
      };
    },
    textarea: (options: { id: string;
      label?: string;
      placeholder?: string;
      value?: string;
      rows?: number;
      disabled?: boolean; }): UIElement => {
      return {
        type: 'textarea',
        ...options,
      };
    },
    separator: (): UIElement => {
      return { type: 'separator' };
    },
    text: (content: string): UIElement => {
      return {
        type: 'text',
        value: content,
      };
    },
    alert: (options: { title: string;
      description?: string;
      tone?: 'info' | 'success' | 'warning' | 'error'; }): UIElement => {
      return {
        type: 'alert',
        label: options.title,
        value: options.description ?? '',
        tone: options.tone ?? 'info',
      };
    },
    image: (options: { id?: string;
      src: string;
      alt?: string; }): UIElement => {
      return {
        type: 'image',
        id: options.id,
        value: options.src,
        label: options.alt,
      };
    },
    previewCard: (options: { thumbnail: string;
      title: string;
      subtitle?: string; }): UIElement => {
      return {
        type: 'previewCard',
        value: options.thumbnail,
        label: options.title,
        subtitle: options.subtitle ?? '',
      };
    },
    previewCardSkeleton: (): UIElement => {
      return { type: 'previewCardSkeleton' };
    },
    skeleton: (options?: { id?: string;
      width?: number;
      height?: number; }): UIElement => {
      const value = options?.width && options?.height
        ? `${options.width}x${options.height}`
        : undefined;
      return {
        type: 'skeleton',
        id: options?.id,
        value,
      };
    },
    button: (options: { id: string;
      label: string;
      variant?: 'primary' | 'secondary' | 'danger';
      size?: 'xs' | 'sm' | 'default' | 'lg';
      disabled?: boolean; }): UIElement => {
      return {
        type: 'button',
        id: options.id,
        label: options.label,
        variant: options.variant,
        size: options.size ?? 'xs',
        disabled: options.disabled,
      };
    },
    renderToolbar: (
      container: HTMLElement,
      elements: UIElement[],
      onButtonClick?: (buttonId: string) => void,
    ): { unmount: () => void } => {
      const app = createApp(ExtensionToolbarView, {
        elements,
        onButtonClick,
      });
      app.mount(container);
      return {
        unmount: () => {
          app.unmount();
        },
      };
    },
  };

  const storageAPI = {
    get: async <T>(key: string): Promise<T | undefined> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(extensionId);
      return settings?.customSettings?.[key] as T | undefined;
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(extensionId);
      const customSettings = {
        ...settings?.customSettings,
        [key]: value,
      };
      await storageStore.updateExtensionSettings(extensionId, { customSettings });
    },
    remove: async (key: string): Promise<void> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(extensionId);

      if (settings?.customSettings) {
        const customSettings = { ...settings.customSettings };
        delete customSettings[key];
        await storageStore.updateExtensionSettings(extensionId, { customSettings });
      }
    },
  };

  const platformAPI = {
    get os() {
      return getPlatformInfo().os;
    },
    get arch() {
      return getPlatformInfo().arch;
    },
    get pathSeparator() {
      return getPlatformInfo().pathSeparator;
    },
    get isWindows() {
      return getPlatformInfo().isWindows;
    },
    get isMacos() {
      return getPlatformInfo().isMacos;
    },
    get isLinux() {
      return getPlatformInfo().isLinux;
    },
    joinPath: (...segments: string[]): string => {
      return segments.join(getPlatformInfo().pathSeparator);
    },
  };

  const BINARY_STORAGE_KEY = '__binaries';

  async function getBinaryStorage(): Promise<Record<string, BinaryInfo>> {
    const storageStore = useExtensionsStorageStore();
    const settings = await storageStore.getExtensionSettings(extensionId);
    return (settings?.customSettings?.[BINARY_STORAGE_KEY] as Record<string, BinaryInfo>) || {};
  }

  async function setBinaryStorage(binaries: Record<string, BinaryInfo>): Promise<void> {
    const storageStore = useExtensionsStorageStore();
    const settings = await storageStore.getExtensionSettings(extensionId);
    const customSettings = {
      ...settings?.customSettings,
      [BINARY_STORAGE_KEY]: binaries,
    };
    await storageStore.updateExtensionSettings(extensionId, { customSettings });
  }

  function parseGitHubRepositoryFromUrl(downloadUrl: string): string | undefined {
    const repositoryInfo = getGitHubRepoInfo(downloadUrl);

    if (!repositoryInfo) {
      return undefined;
    }

    return `https://github.com/${repositoryInfo.owner}/${repositoryInfo.repo}`;
  }

  async function getLatestGitHubVersion(repository: string): Promise<string | undefined> {
    try {
      const tags = await fetchGitHubTags(repository);

      for (const tagName of tags) {
        const parsedVersion = parseVersionFromTag(tagName);

        if (parsedVersion) {
          return parsedVersion;
        }
      }

      return undefined;
    }
    catch {
      return undefined;
    }
  }

  function createExtensionBinaryInfo(result: SharedBinaryInstallResult): BinaryInfo {
    return {
      id: '',
      path: result.path,
      version: result.version,
      storageVersion: result.storageVersion,
      repository: result.repository,
      latestVersion: result.latestVersion,
      hasUpdate: result.hasUpdate,
      latestCheckedAt: result.latestCheckedAt,
      installedAt: result.installedAt,
    };
  }

  function createSharedBinaryInfo(
    binaryId: string,
    result: SharedBinaryInstallResult,
    extensionUserId: string,
  ): SharedBinaryInfo {
    return {
      id: binaryId,
      path: result.path,
      version: result.version,
      storageVersion: result.storageVersion,
      repository: result.repository,
      latestVersion: result.latestVersion,
      hasUpdate: result.hasUpdate,
      latestCheckedAt: result.latestCheckedAt,
      installedAt: result.installedAt,
      usedBy: [extensionUserId],
    };
  }

  async function attachSharedBinaryToExtension(
    binaryId: string,
    lookupVersion: string | undefined,
    result: SharedBinaryInstallResult,
  ): Promise<string> {
    const storageStore = useExtensionsStorageStore();

    await storageStore.setSharedBinary(
      binaryId,
      lookupVersion,
      createSharedBinaryInfo(binaryId, result, extensionId),
    );

    const binaries = await getBinaryStorage();
    binaries[binaryId] = {
      ...createExtensionBinaryInfo(result),
      id: binaryId,
    };
    await setBinaryStorage(binaries);

    return result.path;
  }

  async function ensureSharedBinaryInstalled(
    binaryId: string,
    options: BinaryInstallOptions,
    platform: PlatformOS,
    executableName: string,
    storageVersion: string | null,
    lookupVersion: string | undefined,
  ): Promise<SharedBinaryInstallResult | null> {
    const storageStore = useExtensionsStorageStore();
    const sharedPath = await invoke<string | null>('get_shared_binary_path', {
      binaryId,
      executableName,
      version: lookupVersion ?? null,
    });

    if (sharedPath) {
      const existingSharedBinary = storageStore.getSharedBinary(binaryId, lookupVersion);

      if (existingSharedBinary) {
        return {
          path: sharedPath,
          version: existingSharedBinary.version,
          storageVersion: existingSharedBinary.storageVersion,
          repository: existingSharedBinary.repository,
          latestVersion: existingSharedBinary.latestVersion,
          hasUpdate: existingSharedBinary.hasUpdate,
          latestCheckedAt: existingSharedBinary.latestCheckedAt,
          installedAt: existingSharedBinary.installedAt,
        };
      }

      const repository = options.repository ?? parseGitHubRepositoryFromUrl(
        typeof options.downloadUrl === 'function' ? options.downloadUrl(platform) : options.downloadUrl,
      );

      return {
        path: sharedPath,
        version: options.version,
        storageVersion,
        repository,
        installedAt: Date.now(),
      };
    }

    return null;
  }

  async function downloadSharedBinary(
    binaryId: string,
    options: BinaryInstallOptions,
    executableName: string,
    platform: PlatformOS,
    storageVersion: string | null,
    lookupVersion: string | undefined,
  ): Promise<SharedBinaryInstallResult> {
    const downloadUrl = typeof options.downloadUrl === 'function'
      ? options.downloadUrl(platform)
      : options.downloadUrl;

    const toastId = `binary-download-${extensionId}-${binaryId}`;
    const versionLabel = options.version ? ` ${options.version}` : '';
    const binaryLabel = `${options.name}${versionLabel}`;
    const toastTitle = getExtensionToastTitle();

    let progressValue = 0;
    const progressInterval = setInterval(() => {
      if (progressValue < 90) {
        progressValue += 3;
        toast.custom(markRaw(CustomProgress), {
          id: toastId,
          duration: Infinity,
          componentProps: {
            data: {
              id: toastId,
              title: toastTitle,
              subtitle: t('extensions.api.downloadingDependencies'),
              description: binaryLabel,
              progress: progressValue,
              timer: 0,
              actionText: '',
              cleanup: () => {},
              extensionId,
              extensionIconPath: getExtensionIconPath(),
            },
          },
        });
      }
    }, 200);

    toast.custom(markRaw(CustomProgress), {
      id: toastId,
      duration: Infinity,
      componentProps: {
        data: {
          id: toastId,
          title: toastTitle,
          subtitle: t('extensions.api.downloadingDependencies'),
          description: binaryLabel,
          progress: 0,
          timer: 0,
          actionText: '',
          cleanup: () => {},
          extensionId,
          extensionIconPath: getExtensionIconPath(),
        },
      },
    });

    try {
      const isZipDownload = downloadUrl.toLowerCase().endsWith('.zip');
      const downloadCommand = isZipDownload
        ? 'download_and_extract_shared_binary'
        : 'download_shared_binary';

      const binaryPath = await invoke<string>(downloadCommand, {
        binaryId,
        downloadUrl,
        executableName,
        integrity: options.integrity ?? null,
        version: lookupVersion ?? null,
      });

      clearInterval(progressInterval);
      toast.dismiss(toastId);

      binaryDownloadCounts.set(extensionId, (binaryDownloadCounts.get(extensionId) ?? 0) + 1);

      const repository = options.repository ?? parseGitHubRepositoryFromUrl(downloadUrl);
      const latestVersion = repository ? await getLatestGitHubVersion(repository) : undefined;
      const installedVersion = options.version ?? latestVersion;

      return {
        path: binaryPath,
        version: installedVersion,
        storageVersion,
        repository,
        latestVersion,
        hasUpdate: Boolean(installedVersion && latestVersion && installedVersion !== latestVersion),
        latestCheckedAt: latestVersion ? Date.now() : undefined,
        installedAt: Date.now(),
      };
    }
    catch (error) {
      clearInterval(progressInterval);
      toast.dismiss(toastId);
      throw error;
    }
  }

  async function performBinaryInstall(id: string, options: BinaryInstallOptions): Promise<string> {
    const platformData = await ensurePlatformInfo();
    const platform = platformData.os;
    const executableName = options.executable
      || (platformData.isWindows ? `${options.name}.exe` : options.name);
    const storageVersion = options.version ?? null;
    const lookupVersion = getBinaryLookupVersion({ storageVersion });
    const existingSharedBinary = await ensureSharedBinaryInstalled(
      id,
      options,
      platform,
      executableName,
      storageVersion,
      lookupVersion,
    );

    if (existingSharedBinary) {
      return attachSharedBinaryToExtension(id, lookupVersion, existingSharedBinary);
    }

    const legacyPath = await invoke<string | null>('get_extension_binary_path', {
      extensionId,
      binaryId: id,
      executableName,
    });

    if (legacyPath) {
      return legacyPath;
    }

    const pendingKey = getSharedBinaryPendingKey(id, executableName, lookupVersion);
    const pendingDownload = pendingBinaryDownloads.get(pendingKey);

    if (pendingDownload) {
      const sharedBinaryResult = await pendingDownload;
      return attachSharedBinaryToExtension(id, lookupVersion, sharedBinaryResult);
    }

    const downloadPromise = downloadSharedBinary(
      id,
      options,
      executableName,
      platform,
      storageVersion,
      lookupVersion,
    );

    pendingBinaryDownloads.set(pendingKey, downloadPromise);

    try {
      const sharedBinaryResult = await downloadPromise;
      return attachSharedBinaryToExtension(id, lookupVersion, sharedBinaryResult);
    }
    finally {
      pendingBinaryDownloads.delete(pendingKey);
    }
  }

  const binaryAPI = {
    ensureInstalled: async (id: string, options: BinaryInstallOptions): Promise<string> => {
      if (!hasPermission('shell')) {
        throw new Error(t('extensions.api.permissionDeniedBinary'));
      }

      return performBinaryInstall(id, options);
    },

    getPath: async (id: string): Promise<string | null> => {
      if (!hasPermission('shell')) {
        throw new Error(t('extensions.api.permissionDeniedBinary'));
      }

      const binaries = await getBinaryStorage();
      const info = binaries[id];

      if (!info) {
        return null;
      }

      const executableName = info.path.split(/[/\\]/).pop() || '';
      const lookupVersion = getBinaryLookupVersion(info);

      const sharedExists = await invoke<boolean>('shared_binary_exists', {
        binaryId: id,
        executableName,
        version: lookupVersion ?? null,
      });

      if (sharedExists) {
        const sharedPath = await invoke<string | null>('get_shared_binary_path', {
          binaryId: id,
          executableName,
          version: lookupVersion ?? null,
        });
        return sharedPath;
      }

      const legacyExists = await invoke<boolean>('extension_binary_exists', {
        extensionId,
        binaryId: id,
        executableName,
      });

      return legacyExists ? info.path : null;
    },

    isInstalled: async (id: string): Promise<boolean> => {
      if (!hasPermission('shell')) {
        throw new Error(t('extensions.api.permissionDeniedBinary'));
      }

      const path = await binaryAPI.getPath(id);
      return path !== null;
    },

    remove: async (id: string): Promise<void> => {
      if (!hasPermission('shell')) {
        throw new Error(t('extensions.api.permissionDeniedBinary'));
      }

      const binaries = await getBinaryStorage();
      const info = binaries[id];
      const version = info ? getBinaryLookupVersion(info) : undefined;

      const storageStore = useExtensionsStorageStore();
      const sharedBinary = storageStore.getSharedBinary(id, version);

      if (sharedBinary) {
        await storageStore.removeSharedBinaryUser(id, extensionId, version);

        const updatedBinary = storageStore.getSharedBinary(id, version);

        if (!updatedBinary || updatedBinary.usedBy.length === 0) {
          await invoke('remove_shared_binary', {
            binaryId: id,
            version: version ?? null,
          });
          await storageStore.removeSharedBinaryEntry(id, version);
        }
      }
      else {
        await invoke('remove_extension_binary', {
          extensionId,
          binaryId: id,
        });
      }

      const currentBinaries = await getBinaryStorage();
      delete currentBinaries[id];
      await setBinaryStorage(currentBinaries);
    },

    getInfo: async (id: string): Promise<BinaryInfo | null> => {
      if (!hasPermission('shell')) {
        throw new Error(t('extensions.api.permissionDeniedBinary'));
      }

      const binaries = await getBinaryStorage();
      return binaries[id] || null;
    },
  };

  const settingsAPI = {
    get: async <T>(key: string): Promise<T> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(extensionId);
      const configuration = extensionConfigurations.get(extensionId);

      if (settings?.configurationValues?.[key] !== undefined) {
        return settings.configurationValues[key] as T;
      }

      if (configuration?.properties[key]?.default !== undefined) {
        return configuration.properties[key].default as T;
      }

      return undefined as T;
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(extensionId);
      const oldValue = settings?.configurationValues?.[key];
      const configurationValues = {
        ...settings?.configurationValues,
        [key]: value,
      };

      await storageStore.updateExtensionSettings(extensionId, { configurationValues });
      await notifySettingsChange(extensionId, key, value, oldValue);
    },
    getAll: async (): Promise<Record<string, unknown>> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(extensionId);
      const configuration = extensionConfigurations.get(extensionId);
      const result: Record<string, unknown> = {};

      if (configuration?.properties) {
        for (const [key, prop] of Object.entries(configuration.properties)) {
          result[key] = settings?.configurationValues?.[key] ?? prop.default;
        }
      }

      return result;
    },
    reset: async (key: string): Promise<void> => {
      const storageStore = useExtensionsStorageStore();
      const settings = await storageStore.getExtensionSettings(extensionId);
      const configuration = extensionConfigurations.get(extensionId);
      const oldValue = settings?.configurationValues?.[key];
      const defaultValue = configuration?.properties[key]?.default;

      if (settings?.configurationValues) {
        const configurationValues = { ...settings.configurationValues };
        delete configurationValues[key];
        await storageStore.updateExtensionSettings(extensionId, { configurationValues });
        await notifySettingsChange(extensionId, key, defaultValue, oldValue);
      }
    },
    onChange: (key: string, callback: SettingsChangeCallback): Disposable => {
      const listener: SettingsChangeListener = {
        extensionId,
        key,
        callback,
      };

      settingsChangeListeners.push(listener);

      return {
        dispose: () => {
          const index = settingsChangeListeners.indexOf(listener);

          if (index !== -1) {
            settingsChangeListeners.splice(index, 1);
          }
        },
      };
    },
  };

  const extensionNamespace = `extensions.${extensionId}`;

  function mergeExtensionMessages(messages: Record<string, Record<string, string>>) {
    const parts = extensionId.split('.');
    for (const [locale, localeMessages] of Object.entries(messages)) {
      if (!localeMessages || typeof localeMessages !== 'object') continue;
      let nested: Record<string, unknown> = localeMessages;
      for (let idx = parts.length - 1; idx >= 0; idx--) {
        nested = { [parts[idx]]: nested };
      }
      const toMerge = { extensions: nested };
      i18n.global.mergeLocaleMessage(locale, toMerge);
    }
  }

  const i18nAPI = {
    t: (key: string, params?: Record<string, string | number>) => t(key, params),
    mergeMessages: mergeExtensionMessages,
    mergeFromPath: async (basePath: string) => {
      const appLocales = Object.keys(appMessages) as string[];
      const normalizedBase = basePath.replace(/\/+$/, '');
      let enMessages: Record<string, string> | null = null;
      const enPath = normalizedBase ? `${normalizedBase}/en.json` : 'en.json';
      const enExists = await invoke<boolean>('extension_path_exists', { extensionId, filePath: enPath });
      if (enExists) {
        try {
          const bytes = await invoke<number[]>('read_extension_file', { extensionId, filePath: enPath });
          const content = new TextDecoder().decode(new Uint8Array(bytes));
          const parsed = JSON.parse(content) as Record<string, string>;
          if (parsed && typeof parsed === 'object') enMessages = parsed;
        }
        catch {
        }
      }
      const messages: Record<string, Record<string, string>> = {};
      for (const locale of appLocales) {
        const filePath = normalizedBase ? `${normalizedBase}/${locale}.json` : `${locale}.json`;
        const exists = await invoke<boolean>('extension_path_exists', { extensionId, filePath });
        if (exists) {
          try {
            const bytes = await invoke<number[]>('read_extension_file', { extensionId, filePath });
            const content = new TextDecoder().decode(new Uint8Array(bytes));
            const parsed = JSON.parse(content) as Record<string, string>;
            if (parsed && typeof parsed === 'object') messages[locale] = parsed;
            else if (enMessages) messages[locale] = enMessages;
          }
          catch {
            if (enMessages) messages[locale] = enMessages;
          }
        }
        else if (enMessages) {
          messages[locale] = enMessages;
        }
      }
      if (Object.keys(messages).length > 0) mergeExtensionMessages(messages);
    },
    extensionT: (key: string, params?: Record<string, string | number>) =>
      t(`${extensionNamespace}.${key}`, params),
  };

  const api: SigmaExtensionAPI = {
    i18n: i18nAPI,
    contextMenu: contextMenuAPI,
    sidebar: sidebarAPI,
    toolbar: toolbarAPI,
    commands: commandsAPI,
    context: contextAPI,
    fs: fsAPI,
    ui: uiAPI,
    dialog: dialogAPI,
    shell: shellAPI,
    settings: settingsAPI,
    storage: storageAPI,
    platform: platformAPI,
    binary: binaryAPI,
  };

  return freezeObject(api);
}

export function clearAllRegistrations(): void {
  contextMenuRegistrations.length = 0;
  sidebarRegistrations.length = 0;
  toolbarRegistrations.length = 0;
  commandRegistrations.length = 0;
  keybindingRegistrations.length = 0;
  settingsChangeListeners.length = 0;
  extensionConfigurations.clear();
}

export function clearExtensionRegistrations(extensionId: string): void {
  clearExtensionContextListeners(extensionId);

  for (let registrationIndex = contextMenuRegistrations.length - 1; registrationIndex >= 0; registrationIndex--) {
    if (contextMenuRegistrations[registrationIndex].extensionId === extensionId) {
      contextMenuRegistrations.splice(registrationIndex, 1);
    }
  }

  for (let registrationIndex = sidebarRegistrations.length - 1; registrationIndex >= 0; registrationIndex--) {
    if (sidebarRegistrations[registrationIndex].extensionId === extensionId) {
      sidebarRegistrations.splice(registrationIndex, 1);
    }
  }

  for (let registrationIndex = toolbarRegistrations.length - 1; registrationIndex >= 0; registrationIndex--) {
    if (toolbarRegistrations[registrationIndex].extensionId === extensionId) {
      toolbarRegistrations.splice(registrationIndex, 1);
    }
  }

  for (let registrationIndex = commandRegistrations.length - 1; registrationIndex >= 0; registrationIndex--) {
    if (commandRegistrations[registrationIndex].extensionId === extensionId) {
      commandRegistrations.splice(registrationIndex, 1);
    }
  }

  for (let listenerIndex = settingsChangeListeners.length - 1; listenerIndex >= 0; listenerIndex--) {
    if (settingsChangeListeners[listenerIndex].extensionId === extensionId) {
      settingsChangeListeners.splice(listenerIndex, 1);
    }
  }

  for (let keybindingIndex = keybindingRegistrations.length - 1; keybindingIndex >= 0; keybindingIndex--) {
    if (keybindingRegistrations[keybindingIndex].extensionId === extensionId) {
      keybindingRegistrations.splice(keybindingIndex, 1);
    }
  }

  extensionConfigurations.delete(extensionId);
}
