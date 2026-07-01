// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

describe('binary-path-validation', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('returns false for empty paths', async () => {
    const { validateBinaryPath } = await import('@/modules/extensions/utils/binary-path-validation');

    await expect(validateBinaryPath('   ')).resolves.toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('returns true when path_exists succeeds', async () => {
    invokeMock.mockResolvedValue(true);

    const { validateBinaryPath } = await import('@/modules/extensions/utils/binary-path-validation');

    await expect(validateBinaryPath('C:/tools/ffmpeg.exe')).resolves.toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('path_exists', { path: 'C:/tools/ffmpeg.exe' });
  });

  it('returns false when path_exists fails', async () => {
    invokeMock.mockRejectedValue(new Error('failed'));

    const { validateBinaryPath } = await import('@/modules/extensions/utils/binary-path-validation');

    await expect(validateBinaryPath('C:/missing/ffmpeg.exe')).resolves.toBe(false);
  });
});
