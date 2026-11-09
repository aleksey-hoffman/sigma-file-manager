// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { withTimeout } from '@/utils/with-timeout';

const AUTOSTART_OPERATION_TIMEOUT_MS = 3000;

export async function applyLaunchAtStartupPreference(wantsLaunchAtStartup: boolean): Promise<void> {
  const autostartIsActive = await withTimeout(
    isEnabled,
    'autostart isEnabled',
    AUTOSTART_OPERATION_TIMEOUT_MS,
  );

  if (!wantsLaunchAtStartup) {
    if (!autostartIsActive) {
      return;
    }

    await withTimeout(disable, 'autostart disable', AUTOSTART_OPERATION_TIMEOUT_MS);
    return;
  }

  if (autostartIsActive) {
    return;
  }

  await withTimeout(enable, 'autostart enable', AUTOSTART_OPERATION_TIMEOUT_MS);
}
