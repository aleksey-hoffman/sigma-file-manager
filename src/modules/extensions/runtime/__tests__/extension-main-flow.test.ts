// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// End-to-end-ish coverage of the extension main flow at the layer that runs in
// CI on Linux (vitest + the Rust command tests). A full Tauri WebDriver e2e is
// not possible on this runner (WebKitGTK ships no WebDriver), so this exercises
// the real loader against a mocked Tauri IPC surface and the mocked worker host,
// which is the actual isolation boundary for `api` extensions.
//
// Covered: install/load of a local extension, activation, teardown
// (disable/uninstall), the host-bound caller identity on every privileged IPC
// call, and the realm-escape regression cases. The *real* validateExtensionCode
// is used here (the sandbox module is intentionally not mocked).

import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ApiExtensionManifest } from '@/types/extension';

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
  createWorkerHostMock,
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
  createWorkerHostMock: vi.fn(),
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

vi.mock('@/modules/extensions/runtime/worker-runtime', () => ({
  createWorkerHost: createWorkerHostMock,
}));

import { getLoadedRuntime, loadExtensionRuntime, unloadExtensionRuntime } from '@/modules/extensions/runtime/loader';
import * as runtimeIndex from '@/modules/extensions/runtime';
import { validateExtensionCode } from '@/modules/extensions/runtime/sandbox';

function createManifest(overrides: Partial<ApiExtensionManifest> = {}): ApiExtensionManifest {
  return {
    id: 'sample.extension',
    name: 'Sample Extension',
    version: '1.0.0',
    repository: 'https://github.com/example/sample-extension',
    license: 'MIT',
    extensionType: 'api',
    main: 'index.js',
    permissions: ['commands'],
    activationEvents: ['onStartup'],
    engines: { sigmaFileManager: '>=2.0.0' },
    ...overrides,
  };
}

function mockFilesystem(entrySource: string): void {
  invokeMock.mockImplementation(async (command: string) => {
    switch (command) {
      case 'get_extension_path':
        return '/extensions/sample.extension';
      case 'get_extension_storage_path':
        return '/storage/sample.extension';
      case 'extension_path_exists':
        return true;
      case 'read_extension_file':
        return Array.from(new TextEncoder().encode(entrySource));
      default:
        throw new Error(`Unexpected invoke command: ${command}`);
    }
  });
}

describe('extension main flow', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    createExtensionAPIMock.mockClear();
    initializeWorkerMock.mockReset();
    activateWorkerMock.mockReset();
    deactivateWorkerMock.mockReset();
    destroyWorkerMock.mockReset();
    createWorkerHostMock.mockReset();
    createWorkerHostMock.mockReturnValue({
      initialize: initializeWorkerMock,
      activate: activateWorkerMock,
      deactivate: deactivateWorkerMock,
      disposeActivationResources: vi.fn(),
      destroy: destroyWorkerMock,
    });
    createObjectUrlMock.mockReset();
    revokeObjectUrlMock.mockReset();
    createObjectUrlMock.mockReturnValue('blob:sample.extension:module');
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
    await unloadExtensionRuntime('sample.extension');
  });

  it('installs, activates in the isolated worker, and binds caller identity on every IPC call', async () => {
    mockFilesystem('export function activate() {}');

    await loadExtensionRuntime('sample.extension', createManifest(), 'onStartup');

    // api extensions execute inside the worker isolation host, never in the host realm.
    expect(createWorkerHostMock).toHaveBeenCalledTimes(1);
    expect(initializeWorkerMock).toHaveBeenCalledWith('blob:sample.extension:module');
    expect(activateWorkerMock).toHaveBeenCalledWith({
      extensionId: 'sample.extension',
      extensionPath: '/extensions/sample.extension',
      storagePath: '/storage/sample.extension',
      activationEvent: 'onStartup',
    });

    // Every privileged IPC call carries callerExtensionId set to the owning
    // extension; the extension cannot choose a different identity.
    for (const [, args] of invokeMock.mock.calls) {
      expect((args as { callerExtensionId?: string }).callerExtensionId).toBe('sample.extension');
    }
  });

  it('tears down the worker on disable/uninstall', async () => {
    mockFilesystem('export function activate() {}');
    await loadExtensionRuntime('sample.extension', createManifest(), 'onStartup');
    expect(getLoadedRuntime('sample.extension')).toBeDefined();

    await unloadExtensionRuntime('sample.extension');

    expect(deactivateWorkerMock).toHaveBeenCalled();
    expect(destroyWorkerMock).toHaveBeenCalled();
    expect(getLoadedRuntime('sample.extension')).toBeUndefined();
  });

  it('rejects an entry module that attempts a realm escape before it loads', async () => {
    // Neutral regression for the computed member-access technique: the static
    // screen rejects it, and the module never reaches the worker.
    mockFilesystem('const C = ({})["constructor"]; export const x = C;');

    await expect(
      loadExtensionRuntime('sample.extension', createManifest(), 'onStartup'),
    ).rejects.toThrow('Extension code validation failed');

    expect(initializeWorkerMock).not.toHaveBeenCalled();
    expect(activateWorkerMock).not.toHaveBeenCalled();
    expect(getLoadedRuntime('sample.extension')).toBeUndefined();
  });

  it('does not re-expose a shared-realm in-process sandbox factory', () => {
    expect('createSandbox' in runtimeIndex).toBe(false);
    expect('createSandboxedFunction' in runtimeIndex).toBe(false);
    expect(validateExtensionCode('eval("x")').valid).toBe(false);
  });
});
