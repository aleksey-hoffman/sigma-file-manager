// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

import { openPathDefault } from '@/utils/open-path-default';

describe('openPathDefault', () => {
  it('invokes open_with_default with the file path', async () => {
    invokeMock.mockResolvedValue({ success: true });

    await openPathDefault('C:/Downloads/fluffy/Modmanager.exe');

    expect(invokeMock).toHaveBeenCalledWith('open_with_default', {
      filePath: 'C:/Downloads/fluffy/Modmanager.exe',
    });
  });

  it('throws when the backend reports failure', async () => {
    invokeMock.mockResolvedValue({
      success: false,
      error: 'Path not found',
    });

    await expect(openPathDefault('C:/missing.exe')).rejects.toThrow('Path not found');
  });
});
