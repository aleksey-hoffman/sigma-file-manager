// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';

const AUTOSTART_OPERATION_TIMEOUT_MS = 3000;

class AutostartTimeoutError extends Error {
  constructor(operationName: string, timeoutMs: number) {
    super(`Autostart operation "${operationName}" timed out after ${timeoutMs}ms`);
    this.name = 'AutostartTimeoutError';
  }
}

async function withTimeout<TResult>(
  operation: () => Promise<TResult>,
  operationName: string,
  timeoutMs: number,
): Promise<TResult> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new AutostartTimeoutError(operationName, timeoutMs)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  }
  finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function applyLaunchAtStartupPreference(wantsLaunchAtStartup: boolean): Promise<void> {
  const autostartIsActive = await withTimeout(
    isEnabled,
    'isEnabled',
    AUTOSTART_OPERATION_TIMEOUT_MS,
  );

  if (!wantsLaunchAtStartup) {
    if (!autostartIsActive) {
      return;
    }

    await withTimeout(disable, 'disable', AUTOSTART_OPERATION_TIMEOUT_MS);
    return;
  }

  if (autostartIsActive) {
    return;
  }

  await withTimeout(enable, 'enable', AUTOSTART_OPERATION_TIMEOUT_MS);
}
