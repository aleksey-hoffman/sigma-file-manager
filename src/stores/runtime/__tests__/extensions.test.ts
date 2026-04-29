// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { ApiExtensionManifest, ExtensionManifest } from '@/types/extension';

const {
  invokeMock,
  getVersionMock,
  toastCustomMock,
  toastDismissMock,
  loadExtensionRuntimeMock,
  unloadExtensionRuntimeMock,
  reactivateExtensionRuntimeMock,
  clearBinaryDownloadCountMock,
  commandRegistrations,
  keybindingRegistrations,
  sidebarRegistrations,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  getVersionMock: vi.fn(async () => '2.0.0'),
  toastCustomMock: vi.fn(),
  toastDismissMock: vi.fn(),
  loadExtensionRuntimeMock: vi.fn(),
  unloadExtensionRuntimeMock: vi.fn(),
  reactivateExtensionRuntimeMock: vi.fn(),
  clearBinaryDownloadCountMock: vi.fn(),
  commandRegistrations: [] as Array<{
    extensionId: string;
    command: {
      id: string;
      title: string;
    };
    handler: (...args: unknown[]) => Promise<unknown> | unknown;
  }>,
  keybindingRegistrations: [] as Array<{
    extensionId: string;
    commandId: string;
    keys: {
      ctrl?: boolean;
      alt?: boolean;
      shift?: boolean;
      meta?: boolean;
      key: string;
    };
    when?: string;
  }>,
  sidebarRegistrations: [] as Array<{
    extensionId: string;
    page: {
      id: string;
      title: string;
      icon: string;
      shortcutCommandId?: string;
    };
  }>,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: getVersionMock,
}));

vi.mock('@/data/extensions', async (importOriginal) => {
  const originalModule = await importOriginal<typeof import('@/data/extensions')>();

  return {
    ...originalModule,
    fetchGitHubTags: async (repository: string) => invokeMock('fetch_github_tags', { repository }),
    fetchUrlText: async (url: string) => invokeMock('fetch_url_text', { url }),
  };
});

vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    async save(): Promise<void> {}
    async get(): Promise<undefined> {
      return undefined;
    }

    async set(): Promise<void> {}
  },
}));

vi.mock('vue-sonner', () => ({
  toast: {
    custom: toastCustomMock,
    dismiss: toastDismissMock,
    promise: vi.fn(),
    getHistory: vi.fn(() => []),
    getToasts: vi.fn(() => []),
  },
}));

vi.mock('@/modules/extensions/runtime/loader', () => ({
  loadExtensionRuntime: loadExtensionRuntimeMock,
  unloadExtensionRuntime: unloadExtensionRuntimeMock,
  reactivateExtensionRuntime: reactivateExtensionRuntimeMock,
}));

vi.mock('@/modules/extensions/api', () => ({
  getContextMenuRegistrations: () => [],
  getKeybindingRegistrations: () => keybindingRegistrations,
  getCommandRegistrations: () => commandRegistrations,
  getSidebarRegistrations: () => sidebarRegistrations,
  getToolbarRegistrations: () => [],
  parseKeybindingString: (shortcut: string) => {
    const parts = shortcut.toLowerCase().split('+').map(part => part.trim());
    const keys: {
      ctrl?: boolean;
      alt?: boolean;
      shift?: boolean;
      meta?: boolean;
      key: string;
    } = { key: '' };

    for (const part of parts) {
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
  },
  clearExtensionRegistrations: (extensionId: string) => {
    const remainingRegistrations = commandRegistrations.filter(
      registration => registration.extensionId !== extensionId,
    );
    commandRegistrations.splice(0, commandRegistrations.length, ...remainingRegistrations);
    const remainingKeybindings = keybindingRegistrations.filter(
      registration => registration.extensionId !== extensionId,
    );
    keybindingRegistrations.splice(0, keybindingRegistrations.length, ...remainingKeybindings);
    const remainingSidebarPages = sidebarRegistrations.filter(
      registration => registration.extensionId !== extensionId,
    );
    sidebarRegistrations.splice(0, sidebarRegistrations.length, ...remainingSidebarPages);
  },
  getBinaryDownloadCount: () => 0,
  clearBinaryDownloadCount: clearBinaryDownloadCountMock,
  getBinaryReuseCount: () => 0,
  clearBinaryReuseCount: vi.fn(),
  getPlatformInfo: () => ({
    os: 'windows',
    arch: 'x64',
    pathSeparator: '\\',
    isWindows: true,
    isMacos: false,
    isLinux: false,
  }),
}));

vi.mock('@/modules/extensions/builtin-commands', () => ({
  isBuiltinCommand: () => false,
  getBuiltinCommandHandler: () => undefined,
  getBuiltinCommandDefinitions: () => [],
}));

import externalLinks from '@/data/external-links';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';

function createManifest(): ApiExtensionManifest {
  return {
    id: 'test.video',
    name: 'Test Video',
    version: '1.0.0',
    repository: 'https://github.com/example/test-video',
    license: 'MIT',
    extensionType: 'api',
    main: 'index.js',
    permissions: ['commands'],
    activationEvents: ['onStartup', 'onCommand:test.video.download-video'],
    contributes: {
      commands: [
        {
          id: 'download-video',
          title: 'Download Video',
        },
      ],
    },
    engines: {
      sigmaFileManager: '>=2.0.0',
    },
  };
}

function createRegistryEntry(extensionId: string, repository: string) {
  return {
    id: extensionId,
    name: extensionId,
    description: `${extensionId} description`,
    publisher: {
      name: 'sigma-hub',
      url: 'https://github.com/sigma-hub',
    },
    repository,
    featured: false,
    categories: ['Media'],
    tags: [],
  };
}

function createRemoteManifest(extensionId: string, repository: string): ApiExtensionManifest {
  return {
    id: extensionId,
    name: extensionId,
    version: '1.0.0',
    repository,
    license: 'MIT',
    extensionType: 'api',
    main: 'index.js',
    permissions: ['commands'],
    activationEvents: ['onStartup'],
    engines: {
      sigmaFileManager: '>=2.0.0',
    },
  };
}

function getMainBranchManifestUrl(repository: string): string {
  const repositoryMatch = repository.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);

  if (!repositoryMatch) {
    throw new Error(`Invalid repository URL: ${repository}`);
  }

  const [, owner, repo] = repositoryMatch;
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`;
}

function installTestExtension(
  manifest: ExtensionManifest,
  options: { isLocal?: boolean } = {},
): void {
  const storageStore = useExtensionsStorageStore();
  storageStore.extensionsData.installedExtensions[manifest.id] = {
    version: manifest.version,
    enabled: true,
    autoUpdate: true,
    installedAt: 1,
    manifest,
    settings: {
      scopedDirectories: [],
      customSettings: {},
      keybindingOverrides: [],
    },
    isLocal: options.isLocal,
  };
}

function createDeferredPromise() {
  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: resolvePromise,
  };
}

describe('extensions runtime store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    commandRegistrations.splice(0, commandRegistrations.length);
    keybindingRegistrations.splice(0, keybindingRegistrations.length);
    sidebarRegistrations.splice(0, sidebarRegistrations.length);
    invokeMock.mockReset();
    getVersionMock.mockClear();
    toastCustomMock.mockReset();
    toastDismissMock.mockReset();
    loadExtensionRuntimeMock.mockReset();
    unloadExtensionRuntimeMock.mockReset();
    reactivateExtensionRuntimeMock.mockReset();
    clearBinaryDownloadCountMock.mockReset();
  });

  it('dedupes concurrent extension loads while activation is pending', async () => {
    const manifest = createManifest();
    const registrationHandler = vi.fn();
    const pendingLoad = createDeferredPromise();

    installTestExtension(manifest);

    loadExtensionRuntimeMock.mockImplementation(async (extensionId: string) => {
      commandRegistrations.push({
        extensionId,
        command: {
          id: 'download-video',
          title: 'Download Video',
        },
        handler: registrationHandler,
      });

      await pendingLoad.promise;
    });

    const extensionsStore = useExtensionsStore();
    const firstLoadPromise = extensionsStore.loadExtension(manifest.id, 'onStartup');
    const secondLoadPromise = extensionsStore.loadExtension(manifest.id, 'onStartup');

    expect(loadExtensionRuntimeMock).toHaveBeenCalledTimes(1);
    expect(extensionsStore.loadedExtensions.get(manifest.id)).toMatchObject({
      id: manifest.id,
      state: 'loading',
      activationEvent: 'onStartup',
    });

    pendingLoad.resolve();
    await Promise.all([firstLoadPromise, secondLoadPromise]);

    expect(loadExtensionRuntimeMock).toHaveBeenCalledTimes(1);
    expect(extensionsStore.loadedExtensions.get(manifest.id)).toMatchObject({
      id: manifest.id,
      state: 'loaded',
      activationEvent: 'onStartup',
    });
    expect(extensionsStore.commands).toHaveLength(1);
  });

  it('shows a wait toast instead of running commands during startup setup', async () => {
    const manifest = createManifest();
    const extensionsStore = useExtensionsStore();

    installTestExtension(manifest);

    extensionsStore.loadedExtensions.set(manifest.id, {
      id: manifest.id,
      state: 'loading',
      activationEvent: 'onStartup',
    });

    await extensionsStore.executeCommand(`${manifest.id}.download-video`);

    expect(toastCustomMock).toHaveBeenCalledTimes(1);
    expect(toastCustomMock.mock.calls[0]?.[1]?.componentProps?.data).toMatchObject({
      title: 'Extension | Test Video',
      subtitle: 'Wait until the extension finishes downloading its dependencies',
      extensionId: manifest.id,
    });
    expect(loadExtensionRuntimeMock).not.toHaveBeenCalled();
  });

  it('filters unreachable registry entries when manifest lookup returns 404', async () => {
    const reachableEntry = createRegistryEntry(
      'test.reachable',
      'https://github.com/example/reachable-extension',
    );
    const missingEntry = createRegistryEntry(
      'test.missing',
      'https://github.com/example/missing-extension',
    );
    const registryBody = JSON.stringify({
      schemaVersion: '1.0.0',
      extensions: [reachableEntry, missingEntry],
    });

    invokeMock.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'fetch_github_tags') {
        return [];
      }

      if (command === 'fetch_url_text') {
        if (args?.url === externalLinks.extensionsRegistryUrl) {
          return {
            ok: true,
            status: 200,
            body: registryBody,
          };
        }

        if (args?.url === getMainBranchManifestUrl(reachableEntry.repository)) {
          return {
            ok: true,
            status: 200,
            body: JSON.stringify(createRemoteManifest(reachableEntry.id, reachableEntry.repository)),
          };
        }

        if (args?.url === getMainBranchManifestUrl(missingEntry.repository)) {
          return {
            ok: false,
            status: 404,
            body: '',
          };
        }
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    const extensionsStore = useExtensionsStore();
    await extensionsStore.fetchRegistry(true);

    expect(extensionsStore.availableExtensions.map(extension => extension.id)).toEqual([reachableEntry.id]);
  });

  it('keeps registry entries when reachability validation fails transiently', async () => {
    const reachableEntry = createRegistryEntry(
      'test.reachable',
      'https://github.com/example/reachable-extension',
    );
    const flakyEntry = createRegistryEntry(
      'test.flaky',
      'https://github.com/example/flaky-extension',
    );
    const registryBody = JSON.stringify({
      schemaVersion: '1.0.0',
      extensions: [reachableEntry, flakyEntry],
    });

    invokeMock.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'fetch_github_tags') {
        return [];
      }

      if (command === 'fetch_url_text') {
        if (args?.url === externalLinks.extensionsRegistryUrl) {
          return {
            ok: true,
            status: 200,
            body: registryBody,
          };
        }

        if (args?.url === getMainBranchManifestUrl(reachableEntry.repository)) {
          return {
            ok: true,
            status: 200,
            body: JSON.stringify(createRemoteManifest(reachableEntry.id, reachableEntry.repository)),
          };
        }

        if (args?.url === getMainBranchManifestUrl(flakyEntry.repository)) {
          throw new Error('Failed to fetch URL: connection reset by peer');
        }
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    const extensionsStore = useExtensionsStore();
    await extensionsStore.fetchRegistry(true);

    expect(extensionsStore.availableExtensions.map(extension => extension.id)).toEqual([
      reachableEntry.id,
      flakyEntry.id,
    ]);
  });

  it('removes installed non-local extensions that are no longer in the registry', async () => {
    const approvedEntry = createRegistryEntry(
      'test.approved',
      'https://github.com/example/approved-extension',
    );
    const removedManifest = createRemoteManifest(
      'test.removed',
      'https://github.com/example/removed-extension',
    );
    removedManifest.name = 'Removed Extension';

    const localManifest = createRemoteManifest(
      'test.local',
      'https://github.com/example/local-extension',
    );
    localManifest.name = 'Local Extension';

    installTestExtension(removedManifest);
    installTestExtension(localManifest, { isLocal: true });

    invokeMock.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'fetch_github_tags') {
        return [];
      }

      if (command === 'fetch_url_text') {
        if (args?.url === externalLinks.extensionsRegistryUrl) {
          return {
            ok: true,
            status: 200,
            body: JSON.stringify({
              schemaVersion: '1.0.0',
              extensions: [approvedEntry],
            }),
          };
        }

        if (args?.url === getMainBranchManifestUrl(approvedEntry.repository)) {
          return {
            ok: true,
            status: 200,
            body: JSON.stringify(createRemoteManifest(approvedEntry.id, approvedEntry.repository)),
          };
        }
      }

      if (command === 'cancel_all_extension_commands' || command === 'delete_extension') {
        return undefined;
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    const extensionsStore = useExtensionsStore();
    const storageStore = useExtensionsStorageStore();

    await extensionsStore.fetchRegistry(true);

    expect(storageStore.extensionsData.installedExtensions['test.removed']).toBeUndefined();
    expect(storageStore.extensionsData.installedExtensions['test.local']).toBeDefined();
    expect(invokeMock).toHaveBeenCalledWith('delete_extension', { extensionId: 'test.removed' });
    expect(invokeMock).not.toHaveBeenCalledWith('delete_extension', { extensionId: 'test.local' });
    expect(toastCustomMock).toHaveBeenCalledTimes(1);
    expect(toastCustomMock.mock.calls[0]?.[1]?.componentProps?.data).toMatchObject({
      title: 'Extension | Removed Extension',
      subtitle: 'No longer available',
      description: 'This extension was removed because it is no longer in the approved registry.',
    });
  });

  it('does not remove installed extensions when registry refresh fails and falls back to cache', async () => {
    const cachedEntry = createRegistryEntry(
      'test.cached',
      'https://github.com/example/cached-extension',
    );
    const removedManifest = createRemoteManifest(
      'test.removed',
      'https://github.com/example/removed-extension',
    );

    installTestExtension(removedManifest);

    const storageStore = useExtensionsStorageStore();
    storageStore.extensionsData.registryCache = {
      data: {
        schemaVersion: '1.0.0',
        extensions: [cachedEntry],
      },
      fetchedAt: 123,
    };

    invokeMock.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'fetch_github_tags') {
        return [];
      }

      if (command === 'fetch_url_text' && args?.url === externalLinks.extensionsRegistryUrl) {
        throw new Error('Network error');
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    const extensionsStore = useExtensionsStore();
    await extensionsStore.fetchRegistry(true);

    expect(extensionsStore.availableExtensions.map(extension => extension.id)).toEqual([cachedEntry.id]);
    expect(storageStore.extensionsData.installedExtensions['test.removed']).toBeDefined();
    expect(invokeMock).not.toHaveBeenCalledWith('delete_extension', { extensionId: 'test.removed' });
    expect(toastCustomMock).not.toHaveBeenCalled();
  });

  it('passes install cancellation ids to extension archive downloads', async () => {
    const manifest = createRemoteManifest(
      'test.video',
      'https://github.com/example/test-video',
    );
    manifest.contributes = {
      themes: [
        {
          id: 'midnight',
          title: 'Midnight',
          baseTheme: 'dark',
          variables: {
            '--background': '230 20% 10%',
          },
        },
      ],
    };
    const registryEntry = createRegistryEntry('test.video', manifest.repository);
    const extensionsStore = useExtensionsStore();
    extensionsStore.registry = {
      schemaVersion: '1.0.0',
      extensions: [registryEntry],
    };

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'fetch_url_text') {
        return {
          ok: true,
          status: 200,
          body: JSON.stringify(manifest),
        };
      }

      if (
        command === 'register_extension_install_cancellation'
        || command === 'clear_extension_install_cancellation'
      ) {
        return undefined;
      }

      if (command === 'download_extension') {
        return {
          success: true,
          error: null,
        };
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    await extensionsStore.installExtension('test.video', '1.0.0');

    expect(invokeMock).toHaveBeenCalledWith(
      'download_extension',
      expect.objectContaining({
        extensionId: 'test.video',
        version: '1.0.0',
        cancellationId: expect.any(String),
      }),
    );
    expect(toastCustomMock).toHaveBeenCalledTimes(1);
    expect(toastCustomMock.mock.calls[0]?.[1]?.componentProps?.data).toMatchObject({
      title: 'Extension | test.video',
      subtitle: 'Themes were installed',
      actionText: 'Open settings',
      extensionId: 'test.video',
    });
  });

  it('passes install cancellation ids to extension archive updates', async () => {
    const installedManifest = createRemoteManifest(
      'test.video',
      'https://github.com/example/test-video',
    );
    const updatedManifest = {
      ...installedManifest,
      version: '1.1.0',
    };

    installTestExtension(installedManifest);
    const extensionsStore = useExtensionsStore();
    extensionsStore.registry = {
      schemaVersion: '1.0.0',
      extensions: [createRegistryEntry('test.video', installedManifest.repository)],
    };

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'fetch_url_text') {
        return {
          ok: true,
          status: 200,
          body: JSON.stringify(updatedManifest),
        };
      }

      if (command === 'cancel_all_extension_commands') {
        return undefined;
      }

      if (
        command === 'register_extension_install_cancellation'
        || command === 'clear_extension_install_cancellation'
      ) {
        return undefined;
      }

      if (command === 'download_extension') {
        return {
          success: true,
          error: null,
        };
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    await extensionsStore.updateExtension('test.video', '1.1.0');

    expect(invokeMock).toHaveBeenCalledWith(
      'download_extension',
      expect.objectContaining({
        extensionId: 'test.video',
        version: '1.1.0',
        cancellationId: expect.any(String),
      }),
    );
  });

  it('reloads the previous extension after an update failure', async () => {
    const installedManifest = createRemoteManifest(
      'test.video',
      'https://github.com/example/test-video',
    );
    const updatedManifest = {
      ...installedManifest,
      version: '1.1.0',
    };

    installTestExtension(installedManifest);
    const storageStore = useExtensionsStorageStore();
    storageStore.extensionsData.installedExtensions['test.video']!.settings.customSettings = {
      __binaries: {
        ffmpeg: {
          path: '/extensions/test.video/bin/ffmpeg',
        },
      },
    };
    storageStore.extensionsData.sharedBinaries = {
      'ffmpeg@7.0.0': {
        id: 'ffmpeg',
        path: '/shared/ffmpeg',
        version: '7.0.0',
        storageVersion: '7.0.0',
        installedAt: 123,
        usedBy: ['test.video'],
      },
    };

    const extensionsStore = useExtensionsStore();
    extensionsStore.registry = {
      schemaVersion: '1.0.0',
      extensions: [createRegistryEntry('test.video', installedManifest.repository)],
    };

    invokeMock.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      console.log('invokeMock', args);

      if (command === 'fetch_url_text') {
        return {
          ok: true,
          status: 200,
          body: JSON.stringify(updatedManifest),
        };
      }

      if (command === 'cancel_all_extension_commands') {
        return undefined;
      }

      if (
        command === 'register_extension_install_cancellation'
        || command === 'clear_extension_install_cancellation'
        || command === 'cancel_extension_install_cancellation'
      ) {
        return undefined;
      }

      if (command === 'download_extension') {
        throw new Error('download failed');
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    await expect(extensionsStore.updateExtension('test.video', '1.1.0')).rejects.toThrow('download failed');
    expect(loadExtensionRuntimeMock).toHaveBeenCalledTimes(1);
    expect(loadExtensionRuntimeMock).toHaveBeenCalledWith(
      'test.video',
      installedManifest,
      'onStartup',
    );
    expect(storageStore.extensionsData.installedExtensions['test.video']?.manifest.version).toBe('1.0.0');
    expect(storageStore.extensionsData.installedExtensions['test.video']?.settings.customSettings).toEqual({
      __binaries: {
        ffmpeg: {
          path: '/extensions/test.video/bin/ffmpeg',
        },
      },
    });
    expect(storageStore.extensionsData.sharedBinaries).toEqual({
      'ffmpeg@7.0.0': {
        id: 'ffmpeg',
        path: '/shared/ffmpeg',
        version: '7.0.0',
        storageVersion: '7.0.0',
        installedAt: 123,
        usedBy: ['test.video'],
      },
    });
  });

  it('uninstalls extensions even when orphaned shared binary cleanup is deferred', async () => {
    const manifest = createRemoteManifest(
      'test.video',
      'https://github.com/example/test-video',
    );

    installTestExtension(manifest);
    const storageStore = useExtensionsStorageStore();
    storageStore.extensionsData.installedExtensions['test.video']!.settings.customSettings = {
      __binaries: {
        ffmpeg: {
          id: 'ffmpeg',
          path: '/shared/ffmpeg',
          version: '7.0.0',
        },
      },
    };
    storageStore.extensionsData.sharedBinaries = {
      'ffmpeg@7.0.0': {
        id: 'ffmpeg',
        path: '/shared/ffmpeg',
        version: '7.0.0',
        storageVersion: '7.0.0',
        installedAt: 123,
        usedBy: ['test.video'],
      },
    };

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'cancel_all_extension_commands' || command === 'delete_extension') {
        return undefined;
      }

      if (command === 'remove_shared_binary') {
        throw new Error('binary directory is locked');
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    const extensionsStore = useExtensionsStore();
    await extensionsStore.uninstallExtension('test.video');

    expect(storageStore.extensionsData.installedExtensions['test.video']).toBeUndefined();
    expect(storageStore.extensionsData.sharedBinaries).toEqual({});
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Deferred cleanup for orphaned shared binary ffmpeg:',
      expect.any(Error),
    );

    consoleWarnSpy.mockRestore();
  });

  it('reactivates loaded extensions on locale reload', async () => {
    const manifest = createManifest();
    const extensionsStore = useExtensionsStore();

    installTestExtension(manifest);

    extensionsStore.loadedExtensions.set(manifest.id, {
      id: manifest.id,
      state: 'loaded',
      activationEvent: 'onInstall',
    });

    await extensionsStore.reloadExtensionsLocale();

    expect(reactivateExtensionRuntimeMock).toHaveBeenCalledTimes(1);
    expect(reactivateExtensionRuntimeMock).toHaveBeenCalledWith(manifest.id);
    expect(extensionsStore.loadedExtensions.has(manifest.id)).toBe(true);
  });

  it('unloads extension when locale reactivation fails', async () => {
    const manifest = createManifest();
    const extensionsStore = useExtensionsStore();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    installTestExtension(manifest);

    extensionsStore.loadedExtensions.set(manifest.id, {
      id: manifest.id,
      state: 'loaded',
      activationEvent: 'onStartup',
    });

    reactivateExtensionRuntimeMock.mockRejectedValueOnce(new Error('reactivation failed'));

    await extensionsStore.reloadExtensionsLocale();

    expect(reactivateExtensionRuntimeMock).toHaveBeenCalledTimes(1);
    expect(unloadExtensionRuntimeMock).toHaveBeenCalledWith(manifest.id);
    expect(extensionsStore.loadedExtensions.has(manifest.id)).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it('skips non-loaded extensions during locale reload', async () => {
    const manifest = createManifest();
    const extensionsStore = useExtensionsStore();

    installTestExtension(manifest);

    extensionsStore.loadedExtensions.set(manifest.id, {
      id: manifest.id,
      state: 'loading',
      activationEvent: 'onStartup',
    });

    await extensionsStore.reloadExtensionsLocale();

    expect(reactivateExtensionRuntimeMock).not.toHaveBeenCalled();
  });

  it('keeps local and global extension shortcuts separate for the same command', () => {
    const extensionsStore = useExtensionsStore();
    const storageStore = useExtensionsStorageStore();

    installTestExtension({
      ...createRemoteManifest(
        'test.video',
        'https://github.com/example/test-video',
      ),
      contributes: {
        commands: [
          {
            id: 'open-page',
            title: 'Open Excalidraw',
            shortcut: 'Ctrl+Shift+E',
          },
        ],
      },
    });

    extensionsStore.sidebarPages.push({
      extensionId: 'test.video',
      page: {
        id: 'test.video.excalidraw',
        title: 'Excalidraw',
        icon: 'PencilRuler',
        shortcutCommandId: 'open-page',
      },
    });

    expect(extensionsStore.getSidebarPageKeybinding('test.video.excalidraw')).toMatchObject({
      commandId: 'test.video.open-page',
      keys: {
        ctrl: true,
        shift: true,
        key: 'e',
      },
      scope: 'global',
    });

    storageStore.extensionsData.installedExtensions['test.video']!.settings.keybindingOverrides = [
      {
        commandId: 'test.video.open-page',
        scope: 'global',
        keys: {
          ctrl: true,
          shift: true,
          alt: true,
          key: 'e',
        },
      },
      {
        commandId: 'test.video.open-page',
        scope: 'local',
        keys: {
          ctrl: true,
          alt: true,
          key: 'l',
        },
      },
    ];

    expect(extensionsStore.getSidebarPageKeybinding('test.video.excalidraw')).toMatchObject({
      keys: {
        ctrl: true,
        shift: true,
        alt: true,
        key: 'e',
      },
      source: 'user',
      scope: 'global',
    });

    keybindingRegistrations.push({
      extensionId: 'test.video',
      commandId: 'test.video.open-page',
      keys: {
        ctrl: true,
        key: 'l',
      },
      when: 'always',
    });

    extensionsStore.keybindings.push({
      extensionId: 'test.video',
      commandId: 'test.video.open-page',
      keys: {
        ctrl: true,
        key: 'l',
      },
      when: 'always',
    });

    extensionsStore.applyKeybindingOverride('test.video.open-page', {
      ctrl: true,
      alt: true,
      key: 'l',
    });

    expect(extensionsStore.getCommandShortcut('test.video.open-page')).toMatchObject({
      keys: {
        ctrl: true,
        alt: true,
        key: 'l',
      },
      source: 'user',
      scope: 'local',
      when: 'always',
    });

    expect(extensionsStore.getGlobalCommandShortcuts()).toContainEqual(expect.objectContaining({
      commandId: 'test.video.open-page',
      keys: {
        ctrl: true,
        shift: true,
        alt: true,
        key: 'e',
      },
      source: 'user',
      scope: 'global',
    }));
  });
});
