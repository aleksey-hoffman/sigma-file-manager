// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

import { readExtensionClipboardSourceContext } from '@/modules/extensions/api/clipboard-source';

describe('clipboard-source', () => {
  it('returns source context from the native command', async () => {
    invokeMock.mockResolvedValueOnce({
      windowTitle: 'README.md - Visual Studio Code',
      processName: 'Code.exe',
    });

    await expect(readExtensionClipboardSourceContext()).resolves.toEqual({
      windowTitle: 'README.md - Visual Studio Code',
      processName: 'Code.exe',
    });
  });

  it('returns an empty object when native lookup fails', async () => {
    invokeMock.mockRejectedValueOnce(new Error('lookup failed'));

    await expect(readExtensionClipboardSourceContext()).resolves.toEqual({});
  });
});
