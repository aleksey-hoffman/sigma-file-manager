// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 远程目录的 invoke 封装。
//
// **单独成文件而不是塞进 `virtual-locations.ts`**：那里是「路径 → 内容」的纯分发，
// 而这一层还带着两件与分发无关的事 ——
//   1. command 名的单一定义点（前端只有这里知道 Rust 侧叫什么）；
//   2. 远程错误载荷的解包（见下方 `describeRemoteError`）。
//
// ## 契约（与 Rust 侧一一对应）
//
// - `remote_read_dir` 的 `Err` 载荷是 `RemoteError`，序列化成 `{ kind, message }`
//   （`src-tauri/src/remote/error.rs`）。本地 `read_dir` 的 `Err` 是 `String`。
//   两者形状不同，所以远程的错误**必须**经过 `describeRemoteError` 才进界面。
// - `remote_stat_dir_entry` 失败时返回 `null`，与本地 `get_dir_entry_with_timeout`
//   在 `resolveDirEntry` 里的既有语义保持一致（地址栏自动补全靠它做存在性判断）。
//
// ## 关于「连接配置由谁提供」
//
// 这里**只传 `path`**，不含任何凭据。这是阶段 2 拍板前的最小契约：
// 无论最终是「前端把连接与密码一起传下来」还是「Rust 侧自己解析连接与 DPAPI 密文」，
// `path` 都是必需的，改动只会落在**这个文件**里，不会波及 `virtual-locations.ts`。

import { invoke } from '@tauri-apps/api/core';
import type { DirContents, DirEntry } from '@/types/dir-entry';

/** 列远程目录。失败时抛出的值是 `{ kind, message }`，不是 `String`。 */
export const REMOTE_READ_DIR_COMMAND = 'remote_read_dir';

/** 取单个远程条目的元数据。失败时抛出的值同 `remote_read_dir`。 */
export const REMOTE_STAT_COMMAND = 'remote_stat_dir_entry';

/** `RemoteError` 的前端形状，字段名与 `error.rs` 的 serde 输出一致。 */
export interface RemoteErrorPayload {
  kind: string;
  message: string;
}

export function isRemoteErrorPayload(value: unknown): value is RemoteErrorPayload {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { message?: unknown }).message === 'string'
    && typeof (value as { kind?: unknown }).kind === 'string';
}

export async function readRemoteDirectory(path: string): Promise<DirContents> {
  return invoke<DirContents>(REMOTE_READ_DIR_COMMAND, {
    path,
  });
}

/**
 * 取单个远程条目的元数据。取不到就返回 `null`。
 *
 * **刻意吞掉错误**：`resolveDirEntry` 的既有契约就是「拿不到就给 `null`」，
 * 地址栏的自动补全用它判断路径是否存在。这里换成抛错会让每一次补全失败
 * 都变成一次未捕获异常。
 */
export async function statRemoteEntry(path: string): Promise<DirEntry | null> {
  try {
    return await invoke<DirEntry>(REMOTE_STAT_COMMAND, {
      path,
    });
  }
  catch {
    return null;
  }
}

/**
 * 把捕获到的东西变成一句能给人看的文案。
 *
 * ## 为什么必须有这个函数
 *
 * 导航器在 `use-file-browser-navigation.ts` 里原本写的是
 * `caughtError instanceof Error ? caughtError.message : String(caughtError)`。
 * 远程 `RemoteError` 是**普通对象**，走 `String()` 会得到字面量 `[object Object]`
 * —— 用户在认证失败时看到的是「[object Object]」，而这恰恰是规格 §6.3 明令禁止的
 * 「笼统错误」。所以远程路径的错误必须先解包成 `{ kind, message }` 再取 `message`。
 *
 * 非远程错误（本地的 `String`、真正的 `Error`）一律原样处理，
 * 这样这个函数对两条链路都成立，不会有「只有远程才走这里」的分叉。
 */
export function describeRemoteError(caught: unknown): string {
  if (isRemoteErrorPayload(caught)) {
    return caught.message;
  }

  if (caught instanceof Error) {
    return caught.message;
  }

  return String(caught);
}
