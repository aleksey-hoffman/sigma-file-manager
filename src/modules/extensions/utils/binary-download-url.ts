// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { openUrl } from '@tauri-apps/plugin-opener';

export function isHttpUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

export async function openBinaryDownloadUrl(url: string | undefined): Promise<void> {
  if (url && isHttpUrl(url)) {
    await openUrl(url);
  }
}
