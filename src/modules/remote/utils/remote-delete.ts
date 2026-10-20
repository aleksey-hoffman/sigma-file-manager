// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：远程删除的前端编排。
//
// 为什么要单独一个文件：`deleteRemoteEntries` 里有两件**必须**分开看的事——
//
// 1. **逐个删**。后端 `remote_remove_path` 一条命令只吃一个路径，
//    多选就得前端循环。循环必须是**顺序**的：并发开多条 SFTP 连接会打满
//    服务器的并发连接数（上传/下载那边已经是这个规矩）。
// 2. **失败不许吞**。一个条目失败不影响其余条目，但失败原因必须**逐条**带回来：
//    「权限不足」和「目录不是空的」要给用户完全不同的处置指引。
//
// 错误解包用 `@/utils/remote-directory` 的 `describeRemoteError` ——
// Tauri 把后端的 `RemoteError` 原样 reject 过来（`{ kind, message }` 对象，
// **不是** `Error` 实例），用 `error instanceof Error ? error.message : String(error)`
// 会得到 "[object Object]"。

import type { DirEntry } from '@/types/dir-entry';
import { describeRemoteError, isRemoteErrorPayload } from '@/utils/remote-directory';
import { removeRemotePath } from './remote-transfer';

export interface RemoteDeleteFailure {
  /** 删除失败的条目路径。 */
  path: string;
  /** 给用户看的一句话。 */
  message: string;
  /**
   * 后端的错误分类（`permission` / `not_found` / `protocol` …）。
   * 拿不到时为 `undefined` —— 前端据此决定要不要换一句更具体的提示。
   */
  kind?: string;
}

export interface RemoteDeleteReport {
  /** 删成功的条目路径。 */
  deleted: string[];
  /** 删失败的条目。 */
  failures: RemoteDeleteFailure[];
}

/** 后端把「权限不足」归到这一类。SFTP 能分清；FTP 的 `550` 分不清，按 `not_found` 报。 */
export const REMOTE_PERMISSION_DENIED_KIND = 'permission';

/**
 * 逐个删除远程条目。
 *
 * **不抛错**：单个条目失败不中断整批，失败原因进 `failures`。
 * 抛错会让「删了 3 个成功、第 4 个权限不足」变成「一个都没删」的假象。
 */
export async function deleteRemoteEntries(entries: DirEntry[]): Promise<RemoteDeleteReport> {
  const report: RemoteDeleteReport = {
    deleted: [],
    failures: [],
  };

  for (const entry of entries) {
    try {
      await removeRemotePath(entry.path, entry.is_dir);
      report.deleted.push(entry.path);
    }
    catch (error) {
      report.failures.push({
        path: entry.path,
        message: describeRemoteError(error),
        kind: isRemoteErrorPayload(error) ? error.kind : undefined,
      });
    }
  }

  return report;
}

/** 这批失败里有没有「权限不足」。有的话提示语要换。 */
export function hasPermissionDeniedFailure(report: RemoteDeleteReport): boolean {
  return report.failures.some(failure => failure.kind === REMOTE_PERMISSION_DENIED_KIND);
}
