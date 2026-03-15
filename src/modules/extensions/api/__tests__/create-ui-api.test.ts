// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ExtensionPermission } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

const { writeTextMock } = vi.hoisted(() => ({
  writeTextMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: writeTextMock,
  writeImage: vi.fn(),
}));

vi.mock('@tauri-apps/api/image', () => ({
  Image: { fromBytes: vi.fn() },
}));

vi.mock('vue-sonner', () => ({
  toast: {
    custom: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');

  return {
    ...actual,
    createApp: vi.fn(),
    markRaw: vi.fn((value: unknown) => value),
  };
});

vi.mock('@/modules/extensions/api/modal-state', () => ({
  createModal: vi.fn(),
}));

vi.mock('@/modules/extensions/api/dialog-state', () => ({
  showExtensionDialog: vi.fn(),
}));

vi.mock('@/modules/extensions/components/extension-toolbar-view.vue', () => ({
  default: {},
}));

import { createUiAPI } from '@/modules/extensions/api/create-ui-api';

function createContext(permissions: ExtensionPermission[] = []): ExtensionContext {
  return {
    extensionId: 'test.extension',
    hasPermission: (permission: ExtensionPermission) => permissions.includes(permission),
    t: (key: string, params?: Record<string, string | number>) => params?.permission
      ? `${key}:${params.permission}`
      : key,
    getExtensionPath: vi.fn(),
    getExtensionStoragePath: vi.fn(),
    isPathWithinDirectory: vi.fn(),
    isInExtensionDir: vi.fn(),
    getSharedBinariesDir: vi.fn(),
    isInSharedBinariesDir: vi.fn(),
    isInAllowedReadDir: vi.fn(),
    normalizeRelativePath: vi.fn(),
    resolvePrivatePath: vi.fn(),
    resolveStoragePath: vi.fn(),
    getExtensionName: vi.fn(),
    getExtensionIconPath: vi.fn(),
    getExtensionToastTitle: vi.fn(),
    grantDialogWriteAccess: vi.fn(),
    consumeDialogWriteAccess: vi.fn(),
  };
}

describe('createUiAPI', () => {
  beforeEach(() => {
    writeTextMock.mockReset();
  });

  it('blocks clipboard copy without permission', async () => {
    const uiApi = createUiAPI(createContext());

    await expect(uiApi.copyText('test')).rejects.toThrow(
      'extensions.api.permissionDenied:clipboard',
    );
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it('copies text with clipboard permission', async () => {
    writeTextMock.mockResolvedValueOnce(undefined);
    const uiApi = createUiAPI(createContext(['clipboard' as ExtensionPermission]));

    await expect(uiApi.copyText('copied path')).resolves.toBeUndefined();
    expect(writeTextMock).toHaveBeenCalledWith('copied path');
  });
});
