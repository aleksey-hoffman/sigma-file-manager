// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const invokeAsExtensionMock = vi.hoisted(() => vi.fn());
const convertFileSrcMock = vi.hoisted(() => vi.fn((path: string) => `asset://${path}`));

vi.mock('@/modules/extensions/runtime/extension-invoke', () => ({
  invokeAsExtension: invokeAsExtensionMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: convertFileSrcMock,
}));

import { resolveExtensionStorageAssetUrl } from '@/modules/extensions/utils/resolve-extension-storage-asset-url';

describe('resolveExtensionStorageAssetUrl', () => {
  beforeEach(() => {
    invokeAsExtensionMock.mockReset();
    convertFileSrcMock.mockClear();
  });

  it('resolves extension storage paths to asset URLs', async () => {
    invokeAsExtensionMock.mockResolvedValueOnce('C:/AppData/sigma.clipboard/storage');

    await expect(
      resolveExtensionStorageAssetUrl('sigma.clipboard', 'entries/image.png'),
    ).resolves.toBe('asset://C:/AppData/sigma.clipboard/storage/entries/image.png');

    expect(invokeAsExtensionMock).toHaveBeenCalledWith(
      'sigma.clipboard',
      'get_extension_storage_path',
      { extensionId: 'sigma.clipboard' },
    );
  });

  it('returns undefined when resolution fails', async () => {
    invokeAsExtensionMock.mockRejectedValueOnce(new Error('missing storage'));

    await expect(
      resolveExtensionStorageAssetUrl('sigma.clipboard', 'entries/image.png'),
    ).resolves.toBeUndefined();
  });
});
