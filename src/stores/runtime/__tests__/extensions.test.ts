// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { ExtensionManifest } from '@/types/extension';

const {
  invokeMock,
  getVersionMock,
  toastCustomMock,
  toastDismissMock,
  loadExtensionRuntimeMock,
  unloadExtensionRuntimeMock,
  clearBinaryDownloadCountMock,
  commandRegistrations,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  getVersionMock: vi.fn(async () => '2.0.0'),
  toastCustomMock: vi.fn(),
  toastDismissMock: vi.fn(),
  loadExtensionRuntimeMock: vi.fn(),
  unloadExtensionRuntimeMock: vi.fn(),
  clearBinaryDownloadCountMock: vi.fn(),
  commandRegistrations: [] as Array<{
    extensionId: string;
    command: { id: string;
      title: string; };
    handler: (...args: unknown[]) => Promise<unknown> | unknown;
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
  },
}));

vi.mock('@/modules/extensions/runtime/loader', () => ({
  loadExtensionRuntime: loadExtensionRuntimeMock,
  unloadExtensionRuntime: unloadExtensionRuntimeMock,
}));

vi.mock('@/modules/extensions/api', () => ({
  getContextMenuRegistrations: () => [],
  getKeybindingRegistrations: () => [],
  getCommandRegistrations: () => commandRegistrations,
  getSidebarRegistrations: () => [],
  getToolbarRegistrations: () => [],
  clearExtensionRegistrations: (extensionId: string) => {
    const remainingRegistrations = commandRegistrations.filter(
      registration => registration.extensionId !== extensionId,
    );
    commandRegistrations.splice(0, commandRegistrations.length, ...remainingRegistrations);
  },
  getBinaryDownloadCount: () => 0,
  clearBinaryDownloadCount: clearBinaryDownloadCountMock,
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

import { useExtensionsStore } from '@/stores/runtime/extensions';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';

function createManifest(): ExtensionManifest {
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
    publisher: 'sigma-hub',
    publisherUrl: 'https://github.com/sigma-hub',
    repository,
    featured: false,
    categories: ['Media'],
    tags: [],
  };
}

function createRemoteManifest(extensionId: string, repository: string): ExtensionManifest {
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

function installTestExtension(manifest: ExtensionManifest): void {
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
    invokeMock.mockReset();
    getVersionMock.mockClear();
    toastCustomMock.mockReset();
    toastDismissMock.mockReset();
    loadExtensionRuntimeMock.mockReset();
    unloadExtensionRuntimeMock.mockReset();
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
        if (args?.url === 'https://raw.githubusercontent.com/sigma-hub/sfm-extensions/main/registry.json') {
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
        if (args?.url === 'https://raw.githubusercontent.com/sigma-hub/sfm-extensions/main/registry.json') {
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
});
