// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ExtensionPermission } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

const { writeTextMock, writeImageMock, writeHtmlMock } = vi.hoisted(() => ({
  writeTextMock: vi.fn(),
  writeImageMock: vi.fn(),
  writeHtmlMock: vi.fn(),
}));

const { fromBytesMock } = vi.hoisted(() => ({
  fromBytesMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: writeTextMock,
  writeImage: writeImageMock,
  writeHtml: writeHtmlMock,
}));

vi.mock('@tauri-apps/api/image', () => ({
  Image: { fromBytes: fromBytesMock },
}));

vi.mock('vue-sonner', () => ({
  toast: {
    custom: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
    getHistory: vi.fn(() => []),
    getToasts: vi.fn(() => []),
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
    isInExtensionStorageDir: vi.fn(),
    getSharedBinariesDir: vi.fn(),
    isInSharedBinariesDir: vi.fn(),
    isInAllowedReadDir: vi.fn(),
    isInAllowedWriteDir: vi.fn(),
    normalizeRelativePath: vi.fn(),
    resolvePrivatePath: vi.fn(),
    resolveStoragePath: vi.fn(),
    getExtensionName: vi.fn(),
    getExtensionIconPath: vi.fn(),
    getExtensionToastTitle: vi.fn(),
    grantDialogReadAccess: vi.fn(),
    hasDialogReadAccess: vi.fn(),
    grantDialogWriteAccess: vi.fn(),
    consumeDialogWriteAccess: vi.fn(),
  };
}

describe('createUiAPI', () => {
  beforeEach(() => {
    writeTextMock.mockReset();
    writeImageMock.mockReset();
    writeHtmlMock.mockReset();
    fromBytesMock.mockReset();
  });

  describe('copyText', () => {
    it('blocks without permission', async () => {
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

  describe('clipboardWrite', () => {
    it('blocks without permission', async () => {
      const uiApi = createUiAPI(createContext());

      await expect(uiApi.clipboardWrite([{ 'text/plain': new Uint8Array([104]) }])).rejects.toThrow(
        'extensions.api.permissionDenied:clipboard',
      );
    });

    it('writes text/plain', async () => {
      writeTextMock.mockResolvedValueOnce(undefined);
      const uiApi = createUiAPI(createContext(['clipboard' as ExtensionPermission]));
      const textBytes = new TextEncoder().encode('hello');

      await uiApi.clipboardWrite([{ 'text/plain': textBytes }]);

      expect(writeTextMock).toHaveBeenCalledWith('hello');
      expect(writeImageMock).not.toHaveBeenCalled();
    });

    it('writes image/png', async () => {
      const fakeImage = { type: 'tauri-image' };
      fromBytesMock.mockResolvedValueOnce(fakeImage);
      writeImageMock.mockResolvedValueOnce(undefined);
      const uiApi = createUiAPI(createContext(['clipboard' as ExtensionPermission]));
      const pngBytes = new Uint8Array([137, 80, 78, 71]);

      await uiApi.clipboardWrite([{ 'image/png': pngBytes }]);

      expect(fromBytesMock).toHaveBeenCalledWith(pngBytes);
      expect(writeImageMock).toHaveBeenCalledWith(fakeImage);
      expect(writeTextMock).not.toHaveBeenCalled();
    });

    it('writes text/html with text/plain fallback', async () => {
      writeHtmlMock.mockResolvedValueOnce(undefined);
      const uiApi = createUiAPI(createContext(['clipboard' as ExtensionPermission]));
      const htmlBytes = new TextEncoder().encode('<b>bold</b>');
      const textBytes = new TextEncoder().encode('bold');

      await uiApi.clipboardWrite([{
        'text/html': htmlBytes,
        'text/plain': textBytes,
      }]);

      expect(writeHtmlMock).toHaveBeenCalledWith('<b>bold</b>', 'bold');
      expect(writeTextMock).not.toHaveBeenCalled();
    });

    it('writes text/html without text/plain fallback', async () => {
      writeHtmlMock.mockResolvedValueOnce(undefined);
      const uiApi = createUiAPI(createContext(['clipboard' as ExtensionPermission]));
      const htmlBytes = new TextEncoder().encode('<b>bold</b>');

      await uiApi.clipboardWrite([{ 'text/html': htmlBytes }]);

      expect(writeHtmlMock).toHaveBeenCalledWith('<b>bold</b>', undefined);
    });

    it('prioritizes image/png over text types', async () => {
      const fakeImage = { type: 'tauri-image' };
      fromBytesMock.mockResolvedValueOnce(fakeImage);
      writeImageMock.mockResolvedValueOnce(undefined);
      const uiApi = createUiAPI(createContext(['clipboard' as ExtensionPermission]));

      await uiApi.clipboardWrite([{
        'text/plain': new TextEncoder().encode('text'),
        'image/png': new Uint8Array([137, 80, 78, 71]),
      }]);

      expect(writeImageMock).toHaveBeenCalled();
      expect(writeTextMock).not.toHaveBeenCalled();
      expect(writeHtmlMock).not.toHaveBeenCalled();
    });

    it('prioritizes text/html over text/plain', async () => {
      writeHtmlMock.mockResolvedValueOnce(undefined);
      const uiApi = createUiAPI(createContext(['clipboard' as ExtensionPermission]));

      await uiApi.clipboardWrite([{
        'text/plain': new TextEncoder().encode('plain'),
        'text/html': new TextEncoder().encode('<p>rich</p>'),
      }]);

      expect(writeHtmlMock).toHaveBeenCalledWith('<p>rich</p>', 'plain');
      expect(writeTextMock).not.toHaveBeenCalled();
    });

    it('rejects non-PNG image types', async () => {
      const uiApi = createUiAPI(createContext(['clipboard' as ExtensionPermission]));
      const jpegBytes = new Uint8Array([255, 216, 255, 224]);

      await expect(
        uiApi.clipboardWrite([{ 'image/jpeg': jpegBytes }]),
      ).rejects.toThrow('No supported clipboard types found');

      expect(fromBytesMock).not.toHaveBeenCalled();
      expect(writeImageMock).not.toHaveBeenCalled();
    });

    it('throws for unsupported MIME types only', async () => {
      const uiApi = createUiAPI(createContext(['clipboard' as ExtensionPermission]));

      await expect(
        uiApi.clipboardWrite([{ 'application/pdf': new Uint8Array([1, 2, 3]) }]),
      ).rejects.toThrow('No supported clipboard types found');
    });

    it('uses first item with a supported type', async () => {
      writeTextMock.mockResolvedValueOnce(undefined);
      const uiApi = createUiAPI(createContext(['clipboard' as ExtensionPermission]));

      await uiApi.clipboardWrite([
        { 'application/octet-stream': new Uint8Array([1]) },
        { 'text/plain': new TextEncoder().encode('second item') },
      ]);

      expect(writeTextMock).toHaveBeenCalledWith('second item');
    });

    it('handles empty items array without error', async () => {
      const uiApi = createUiAPI(createContext(['clipboard' as ExtensionPermission]));

      await expect(uiApi.clipboardWrite([])).resolves.toBeUndefined();
    });
  });
});
