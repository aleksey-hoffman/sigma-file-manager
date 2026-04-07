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
  clearExtensionActivationRegistrationsMock,
  initializeWorkerMock,
  activateWorkerMock,
  deactivateWorkerMock,
  destroyWorkerMock,
  validateExtensionCodeMock,
  createObjectUrlMock,
  revokeObjectUrlMock,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  createExtensionAPIMock: vi.fn(() => ({})),
  registerExtensionConfigurationMock: vi.fn(),
  registerExtensionKeybindingsMock: vi.fn(),
  clearExtensionRegistrationsMock: vi.fn(),
  clearExtensionActivationRegistrationsMock: vi.fn(),
  initializeWorkerMock: vi.fn(),
  activateWorkerMock: vi.fn(),
  deactivateWorkerMock: vi.fn(),
  destroyWorkerMock: vi.fn(),
  validateExtensionCodeMock: vi.fn(() => ({
    valid: true,
    errors: [],
  })),
  createObjectUrlMock: vi.fn(),
  revokeObjectUrlMock: vi.fn(),
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
  clearExtensionActivationRegistrations: clearExtensionActivationRegistrationsMock,
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
    clearExtensionActivationRegistrationsMock.mockClear();
    initializeWorkerMock.mockReset();
    activateWorkerMock.mockReset();
    deactivateWorkerMock.mockReset();
    destroyWorkerMock.mockReset();
    validateExtensionCodeMock.mockClear();
    createObjectUrlMock.mockReset();
    revokeObjectUrlMock.mockReset();
    createObjectUrlMock
      .mockReturnValueOnce('blob:test.video:helper')
      .mockReturnValueOnce('blob:test.video:index');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });
  });

  afterEach(async () => {
    await unloadExtensionRuntime('test.video');
  });

  it('passes persistent storagePath to api extension activate context', async () => {
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

    expect(invokeMock.mock.calls).toEqual([
      [
        'get_extension_path',
        {
          extensionId: 'test.video',
          callerExtensionId: 'test.video',
        },
      ],
      [
        'get_extension_storage_path',
        {
          extensionId: 'test.video',
          callerExtensionId: 'test.video',
        },
      ],
      [
        'extension_path_exists',
        {
          extensionId: 'test.video',
          filePath: 'index.js',
          callerExtensionId: 'test.video',
        },
      ],
      [
        'read_extension_file',
        {
          extensionId: 'test.video',
          filePath: 'index.js',
          callerExtensionId: 'test.video',
        },
      ],
    ]);

    expect(createExtensionAPIMock).toHaveBeenCalledWith('test.video', ['commands']);
    expect(initializeWorkerMock).toHaveBeenCalledWith(expect.stringMatching(/^asset:\/\/\/extensions\/test\.video\/index\.js\?runtime=\d+$/));
    expect(activateWorkerMock).toHaveBeenCalledWith({
      extensionId: 'test.video',
      extensionPath: '/extensions/test.video',
      storagePath: '/storage/test.video',
      activationEvent: 'onStartup',
    });
  });

  it('loads Windows api extensions through blob module URLs', async () => {
    invokeMock.mockImplementation(async (command: string, args?: { filePath?: string }) => {
      switch (command) {
        case 'get_extension_path':
          return 'C:\\Users\\aleks\\AppData\\Roaming\\com.sigma-file-manager.app\\extensions\\test.video';
        case 'get_extension_storage_path':
          return 'C:\\Users\\aleks\\AppData\\Roaming\\com.sigma-file-manager.app\\extension-storage\\test.video';
        case 'extension_path_exists':
          return true;
        case 'read_extension_file':
          if (args?.filePath === 'index.js') {
            return Array.from(new TextEncoder().encode('import "./lib/helper.js"; export {};'));
          }

          if (args?.filePath === 'lib/helper.js') {
            return Array.from(new TextEncoder().encode('export const helper = () => "ok";'));
          }

          throw new Error(`Unexpected filePath: ${args?.filePath}`);
        default:
          throw new Error(`Unexpected invoke command: ${command}`);
      }
    });

    await loadExtensionRuntime('test.video', createManifest(), 'onStartup');

    expect(createObjectUrlMock).toHaveBeenCalledTimes(2);
    expect(initializeWorkerMock).toHaveBeenCalledWith('blob:test.video:index');

    await unloadExtensionRuntime('test.video');

    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:test.video:index');
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:test.video:helper');
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

  it('cleans up runtime when unloaded during loading', async () => {
    let rejectInitialize!: (error: Error) => void;
    initializeWorkerMock.mockImplementation(
      () => new Promise<void>((_resolve, reject) => { rejectInitialize = reject; }),
    );

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

    const loadPromise = loadExtensionRuntime('test.video', createManifest(), 'onStartup');

    await vi.waitFor(() => {
      expect(initializeWorkerMock).toHaveBeenCalled();
    });

    expect(getLoadedRuntime('test.video')).toBeDefined();

    await unloadExtensionRuntime('test.video');

    expect(getLoadedRuntime('test.video')).toBeUndefined();
    expect(destroyWorkerMock).toHaveBeenCalledTimes(1);

    rejectInitialize(new Error('Extension worker destroyed'));

    await expect(loadPromise).rejects.toThrow();
    expect(getLoadedRuntime('test.video')).toBeUndefined();
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
