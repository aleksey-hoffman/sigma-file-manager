// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { getCurrentWindow } from '@tauri-apps/api/window';

export async function toggleMainWindowFullscreen(): Promise<boolean> {
  const currentWindow = getCurrentWindow();
  const nextState = !(await currentWindow.isFullscreen());
  await currentWindow.setFullscreen(nextState);
  return nextState;
}
