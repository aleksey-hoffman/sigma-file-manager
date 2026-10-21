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

/**
 * 「最大化」按钮的行为。
 *
 * 全屏状态下点最大化**不是**去最大化一个全屏窗口（那会得到一个「既全屏又最大化」
 * 的怪状态：标题栏叠在任务栏上，拖不动也关不掉），而是先退出全屏。
 */
export async function toggleMainWindowMaximized(): Promise<void> {
  const currentWindow = getCurrentWindow();

  if (await currentWindow.isFullscreen()) {
    await currentWindow.setFullscreen(false);
    return;
  }

  await currentWindow.toggleMaximize();
}
