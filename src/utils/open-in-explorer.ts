// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';

/**
 * 在 Windows Explorer 中选中并显示目标文件（explorer.exe /select,<path>）。
 * 调用 Rust 侧 `reveal_in_explorer` command。非 Windows 平台会返回错误。
 */
export async function revealInExplorer(path: string): Promise<void> {
  await invoke('reveal_in_explorer', { path });
}