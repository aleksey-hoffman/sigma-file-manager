// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { readExtensionClipboardSnapshot, readExtensionClipboardImagePayload } from '@/modules/extensions/api/clipboard-read';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

const { getPlatformInfoMock } = vi.hoisted(() => ({
  getPlatformInfoMock: vi.fn(() => ({
    os: 'windows',
    arch: 'x64',
    pathSeparator: '\\',
    isWindows: true,
    isMacos: false,
    isLinux: false,
  })),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@/utils/platform-info', () => ({
  getPlatformInfo: getPlatformInfoMock,
  ensurePlatformInfo: vi.fn(async () => getPlatformInfoMock()),
}));

function mockChangeToken(token = '42'): void {
  invokeMock.mockResolvedValueOnce(token);
}

describe('readExtensionClipboardSnapshot', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    getPlatformInfoMock.mockReturnValue({
      os: 'windows',
      arch: 'x64',
      pathSeparator: '\\',
      isWindows: true,
      isMacos: false,
      isLinux: false,
    });
  });

  it('returns files snapshot when clipboard contains file paths', async () => {
    mockChangeToken();
    invokeMock.mockResolvedValueOnce({
      paths: ['C:\\Users\\demo\\file.txt'],
      operation: 'copy',
    });

    const snapshot = await readExtensionClipboardSnapshot();

    expect(snapshot.type).toBe('files');
    expect(snapshot.changeToken).toBe('42');
    expect(snapshot.files?.paths).toEqual(['C:\\Users\\demo\\file.txt']);
    expect(snapshot.preview).toBe('file.txt');
    expect(snapshot.fingerprint).not.toBe('');
  });

  it('returns lightweight image snapshot without loading image bytes', async () => {
    mockChangeToken('99');
    invokeMock
      .mockResolvedValueOnce({
        paths: [],
        operation: 'copy',
      })
      .mockResolvedValueOnce({
        width: 100,
        height: 50,
        sizeBytes: 20000,
        clipboardSequence: 42,
      });

    const snapshot = await readExtensionClipboardSnapshot();

    expect(snapshot.type).toBe('image');
    expect(snapshot.changeToken).toBe('99');
    expect(snapshot.image).toEqual({
      width: 100,
      height: 50,
      sizeBytes: 20000,
    });
    expect('pngBytes' in (snapshot.image ?? {})).toBe(false);
    expect(invokeMock).not.toHaveBeenCalledWith('save_system_clipboard_image_to_temp');
  });

  it('returns text snapshot when clipboard contains plain text', async () => {
    mockChangeToken();
    invokeMock
      .mockResolvedValueOnce({
        paths: [],
        operation: 'copy',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('hello clipboard');

    const snapshot = await readExtensionClipboardSnapshot();

    expect(snapshot.type).toBe('text');
    expect(snapshot.text).toBe('hello clipboard');
    expect(snapshot.preview).toBe('hello clipboard');
  });

  it('returns empty snapshot when clipboard has no supported content', async () => {
    mockChangeToken();
    invokeMock
      .mockResolvedValueOnce({
        paths: [],
        operation: 'copy',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('');

    const snapshot = await readExtensionClipboardSnapshot();

    expect(snapshot).toEqual({
      type: 'empty',
      changeToken: '42',
      fingerprint: '',
      preview: '',
    });
  });

  it('returns empty snapshot when clipboard text read fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockChangeToken();
    invokeMock
      .mockResolvedValueOnce({
        paths: [],
        operation: 'copy',
      })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('OpenClipboard failed: Access is denied.'));

    const snapshot = await readExtensionClipboardSnapshot();

    expect(snapshot).toEqual({
      type: 'empty',
      changeToken: '42',
      fingerprint: '',
      preview: '',
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('falls back to the web clipboard on Linux when Rust returns empty text', async () => {
    getPlatformInfoMock.mockReturnValue({
      os: 'linux',
      arch: 'x64',
      pathSeparator: '/',
      isWindows: false,
      isMacos: false,
      isLinux: true,
    });

    const readTextMock = vi.fn().mockResolvedValue('hello from web clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: readTextMock,
      },
    });

    mockChangeToken('rust-token');
    invokeMock
      .mockResolvedValueOnce({
        paths: [],
        operation: 'copy',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('');

    const snapshot = await readExtensionClipboardSnapshot();

    expect(readTextMock).toHaveBeenCalled();
    expect(snapshot.type).toBe('text');
    expect(snapshot.text).toBe('hello from web clipboard');
    expect(snapshot.changeToken).toContain('rust-token');
    expect(snapshot.changeToken).toContain('web:');
  });
});

describe('readExtensionClipboardImagePayload', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('returns null when saved image bytes are not a valid PNG', async () => {
    invokeMock.mockResolvedValueOnce({
      width: 100,
      height: 50,
      sizeBytes: 0,
      pngBytes: [],
    });

    const payload = await readExtensionClipboardImagePayload();

    expect(payload).toBeNull();
  });

  it('returns image payload when saved image bytes are a valid PNG', async () => {
    const pngBytes = Uint8Array.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x01, 0x02,
    ]);

    invokeMock.mockResolvedValueOnce({
      width: 100,
      height: 50,
      sizeBytes: pngBytes.length,
      pngBytes: Array.from(pngBytes),
    });

    const payload = await readExtensionClipboardImagePayload();

    expect(payload?.width).toBe(100);
    expect(payload?.height).toBe(50);
    expect(payload?.sizeBytes).toBe(pngBytes.length);
    expect(payload?.pngBytes).toEqual(pngBytes);
    expect(payload?.contentFingerprint).toEqual(expect.any(String));
    expect(invokeMock).toHaveBeenCalledWith('read_system_clipboard_image_png_bytes');
  });
});
