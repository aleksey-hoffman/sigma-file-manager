// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ExtensionManifest } from '@/types/extension';

const {
  invokeMock,
  createExtensionAPIMock,
  registerExtensionConfigurationMock,
  registerExtensionKeybindingsMock,
  clearExtensionRegistrationsMock,
  initializeWorkerMock,
  activateWorkerMock,
  deactivateWorkerMock,
  destroyWorkerMock,
  validateExtensionCodeMock,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  createExtensionAPIMock: vi.fn(() => ({})),
  registerExtensionConfigurationMock: vi.fn(),
  registerExtensionKeybindingsMock: vi.fn(),
  clearExtensionRegistrationsMock: vi.fn(),
  initializeWorkerMock: vi.fn(),
  activateWorkerMock: vi.fn(),
  deactivateWorkerMock: vi.fn(),
  destroyWorkerMock: vi.fn(),
  validateExtensionCodeMock: vi.fn(() => ({
    valid: true,
    errors: [],
  })),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

vi.mock('@/modules/extensions/api', () => ({
  createExtensionAPI: createExtensionAPIMock,
  registerExtensionConfiguration: registerExtensionConfigurationMock,
  registerExtensionKeybindings: registerExtensionKeybindingsMock,
  clearExtensionRegistrations: clearExtensionRegistrationsMock,
}));

vi.mock('@/modules/extensions/runtime/sandbox', () => ({
  validateExtensionCode: validateExtensionCodeMock,
}));

vi.mock('@/modules/extensions/runtime/worker-runtime', () => ({
  createWorkerHost: vi.fn(() => ({
    initialize: initializeWorkerMock,
    activate: activateWorkerMock,
    deactivate: deactivateWorkerMock,
    destroy: destroyWorkerMock,
  })),
}));

import { getLoadedRuntime, loadExtensionRuntime, unloadExtensionRuntime } from '@/modules/extensions/runtime/loader';

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
    activationEvents: ['onStartup'],
    engines: {
      sigmaFileManager: '>=2.0.0',
    },
  };
}

describe('extension runtime loader', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    createExtensionAPIMock.mockClear();
    registerExtensionConfigurationMock.mockClear();
    registerExtensionKeybindingsMock.mockClear();
    clearExtensionRegistrationsMock.mockClear();
    initializeWorkerMock.mockReset();
    activateWorkerMock.mockReset();
    deactivateWorkerMock.mockReset();
    destroyWorkerMock.mockReset();
    validateExtensionCodeMock.mockClear();
  });

  afterEach(async () => {
    await unloadExtensionRuntime('test.video');
  });

  it('passes persistent storagePath to api extension activate context', async () => {
    invokeMock.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      switch (command) {
        case 'get_extension_path':
          expect(args).toEqual({
            extensionId: 'test.video',
            callerExtensionId: 'test.video',
          });
          return '/extensions/test.video';
        case 'get_extension_storage_path':
          expect(args).toEqual({
            extensionId: 'test.video',
            callerExtensionId: 'test.video',
          });
          return '/storage/test.video';
        case 'extension_path_exists':
          expect(args).toEqual({
            extensionId: 'test.video',
            filePath: 'index.js',
            callerExtensionId: 'test.video',
          });
          return true;
        case 'read_extension_file':
          expect(args).toEqual({
            extensionId: 'test.video',
            filePath: 'index.js',
            callerExtensionId: 'test.video',
          });
          return Array.from(new TextEncoder().encode('export {};'));
        default:
          throw new Error(`Unexpected invoke command: ${command}`);
      }
    });

    await loadExtensionRuntime('test.video', createManifest(), 'onStartup');

    expect(createExtensionAPIMock).toHaveBeenCalledWith('test.video', ['commands']);
    expect(initializeWorkerMock).toHaveBeenCalledWith(expect.stringMatching(/^asset:\/\/\/extensions\/test\.video\/index\.js\?runtime=\d+$/));
    expect(activateWorkerMock).toHaveBeenCalledWith({
      extensionId: 'test.video',
      extensionPath: '/extensions/test.video',
      storagePath: '/storage/test.video',
      activationEvent: 'onStartup',
    });
  });

  it('propagates activation failures instead of creating placeholder runtime', async () => {
    const activationError = new Error('Activation failed');
    activateWorkerMock.mockRejectedValueOnce(activationError);
    invokeMock.mockImplementation(async (command: string) => {
      switch (command) {
        case 'get_extension_path':
          return '/extensions/test.video';
        case 'get_extension_storage_path':
          return '/storage/test.video';
        case 'extension_path_exists':
          return true;
        case 'read_extension_file':
          return Array.from(new TextEncoder().encode('export {};'));
        default:
          throw new Error(`Unexpected invoke command: ${command}`);
      }
    });

    await expect(
      loadExtensionRuntime('test.video', createManifest(), 'onStartup'),
    ).rejects.toThrow('Activation failed');

    expect(getLoadedRuntime('test.video')).toBeUndefined();
    expect(clearExtensionRegistrationsMock).toHaveBeenCalledWith('test.video');
    expect(destroyWorkerMock).toHaveBeenCalledTimes(1);
  });

  it('destroys the worker host when unloading an api extension', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      switch (command) {
        case 'get_extension_path':
          return '/extensions/test.video';
        case 'get_extension_storage_path':
          return '/storage/test.video';
        case 'extension_path_exists':
          return true;
        case 'read_extension_file':
          return Array.from(new TextEncoder().encode('export {};'));
        default:
          throw new Error(`Unexpected invoke command: ${command}`);
      }
    });

    await loadExtensionRuntime('test.video', createManifest(), 'onStartup');
    await unloadExtensionRuntime('test.video');

    expect(destroyWorkerMock).toHaveBeenCalledTimes(1);
  });
});
