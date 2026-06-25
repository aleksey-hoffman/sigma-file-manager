// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { convertFileSrc } from '@tauri-apps/api/core';
import { invokeAsExtension } from '@/modules/extensions/runtime/extension-invoke';

function joinStoragePath(storageRoot: string, relativePath: string): string {
  const normalizedRelativePath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const pathSeparator = storageRoot.includes('\\') ? '\\' : '/';

  if (storageRoot.endsWith('/') || storageRoot.endsWith('\\')) {
    return `${storageRoot}${normalizedRelativePath}`;
  }

  return `${storageRoot}${pathSeparator}${normalizedRelativePath}`;
}

export async function resolveExtensionStorageAssetUrl(
  extensionId: string,
  relativePath: string,
): Promise<string | undefined> {
  if (!extensionId || !relativePath.trim()) {
    return undefined;
  }

  try {
    const storageRoot = await invokeAsExtension<string>(
      extensionId,
      'get_extension_storage_path',
      { extensionId },
    );

    return convertFileSrc(joinStoragePath(storageRoot, relativePath));
  }
  catch {
    return undefined;
  }
}
