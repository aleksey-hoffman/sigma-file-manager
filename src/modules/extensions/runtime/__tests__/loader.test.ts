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
  evaluateMock,
  destroyMock,
  validateExtensionCodeMock,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  createExtensionAPIMock: vi.fn(() => ({})),
  registerExtensionConfigurationMock: vi.fn(),
  registerExtensionKeybindingsMock: vi.fn(),
  evaluateMock: vi.fn(),
  destroyMock: vi.fn(),
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
}));

vi.mock('@/modules/extensions/runtime/sandbox', () => ({
  createSandbox: vi.fn(() => ({
    extensionId: 'test.video',
    globalContext: {},
    console,
    evaluate: evaluateMock,
    destroy: destroyMock,
  })),
  validateExtensionCode: validateExtensionCodeMock,
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
    evaluateMock.mockReset();
    destroyMock.mockClear();
    validateExtensionCodeMock.mockClear();
  });

  afterEach(async () => {
    await unloadExtensionRuntime('test.video');
  });

  it('passes persistent storagePath to api extension activate context', async () => {
    const activateMock = vi.fn();
    evaluateMock.mockReturnValue({
      activate: activateMock,
      deactivate: vi.fn(),
    });
    invokeMock.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      switch (command) {
        case 'get_extension_path':
          expect(args).toEqual({ extensionId: 'test.video' });
          return '/extensions/test.video';
        case 'get_extension_storage_path':
          expect(args).toEqual({ extensionId: 'test.video' });
          return '/storage/test.video';
        case 'extension_path_exists':
          return true;
        case 'read_extension_file':
          return Array.from(new TextEncoder().encode('module.exports = {};'));
        default:
          throw new Error(`Unexpected invoke command: ${command}`);
      }
    });

    await loadExtensionRuntime('test.video', createManifest(), 'onStartup');

    expect(createExtensionAPIMock).toHaveBeenCalledWith('test.video', ['commands']);
    expect(activateMock).toHaveBeenCalledWith({
      extensionId: 'test.video',
      extensionPath: '/extensions/test.video',
      storagePath: '/storage/test.video',
      activationEvent: 'onStartup',
    });
  });

  it('propagates activation failures instead of creating placeholder runtime', async () => {
    const activationError = new Error('Activation failed');
    evaluateMock.mockReturnValue({
      activate: () => { throw activationError; },
      deactivate: vi.fn(),
    });
    invokeMock.mockImplementation(async (command: string) => {
      switch (command) {
        case 'get_extension_path':
          return '/extensions/test.video';
        case 'get_extension_storage_path':
          return '/storage/test.video';
        case 'extension_path_exists':
          return true;
        case 'read_extension_file':
          return Array.from(new TextEncoder().encode('module.exports = {};'));
        default:
          throw new Error(`Unexpected invoke command: ${command}`);
      }
    });

    await expect(
      loadExtensionRuntime('test.video', createManifest(), 'onStartup'),
    ).rejects.toThrow('Activation failed');

    expect(getLoadedRuntime('test.video')).toBeUndefined();
  });
});
