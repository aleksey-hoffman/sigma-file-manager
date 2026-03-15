// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';

type InvokeArgs = Record<string, unknown> | undefined;

export async function invokeAsExtension<T>(
  extensionId: string,
  command: string,
  args?: InvokeArgs,
): Promise<T> {
  return invoke<T>(command, {
    ...(args ?? {}),
    callerExtensionId: extensionId,
  });
}
