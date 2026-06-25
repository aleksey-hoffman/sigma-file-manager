// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import type { ExtensionClipboardSourceContext } from '@sigma-file-manager/api';

export async function readExtensionClipboardSourceContext(): Promise<ExtensionClipboardSourceContext> {
  try {
    return await invoke<ExtensionClipboardSourceContext>('get_clipboard_source_context');
  }
  catch {
    return {};
  }
}
