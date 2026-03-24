// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';

export async function applyLaunchAtStartupPreference(wantsLaunchAtStartup: boolean): Promise<void> {
  const autostartIsActive = await isEnabled();

  if (!wantsLaunchAtStartup) {
    if (!autostartIsActive) {
      return;
    }

    await disable();
    return;
  }

  if (autostartIsActive) {
    return;
  }

  await enable();
}
