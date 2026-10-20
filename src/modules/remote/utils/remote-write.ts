// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：远程写操作（新建目录 / 重命名）的前端编排。
//
// 为什么单独一个文件：`remote-transfer.ts` 是**调用层**（只有 invoke 封装），
// 而这一层是**编排层**（拼路径、映射错误、决定哪些能做哪些不能做）。
// 两者混在一起的话，「远程目录能不能新建文件」这条产品规则就会散落到
// 各个界面文件里 —— 而产品规则应该只有一处。
//
// ## 三条产品规则都落在这一个文件里
//
// 1. **远程「新建空文件」永远不做**（规格 §1：永久非目标）。
//    SFTP 没有 `CREATE`，FTP 的 `STOR` 需要先有本地文件。
//    强行实现会得到一个行为不可预期的功能。
// 2. **远程「新建目录」可以**（阶段 3）。
// 3. **远程「重命名」可以，且只在原目录内改名**（阶段 3）。
//    跨目录移动是另一件事，不在这一轮。

import type { DirEntry } from '@/types/dir-entry';
import { describeRemoteError, isRemoteErrorPayload } from '@/utils/remote-directory';
import { buildRemotePath, isRemotePath, parseRemotePath } from '@/utils/remote-paths';
import { makeRemoteDirectory, renameRemotePath } from './remote-transfer';

/** 一次远程写操作的结果。 */
export interface RemoteWriteResult {
  /** 成功与否。**失败时不抛错**，失败原因进 `message`。 */
  ok: boolean;
  /** 给用户看的一句话。成功时为空。 */
  message: string;
  /**
   * 后端的错误分类（`permission` / `not_found` / `protocol` …）。
   * 拿不到时为 `undefined` —— 前端据此决定要不要换一句更具体的提示。
   */
  kind?: string;
}

/**
 * 这个目录能不能「新建空文件」。
 *
 * **远程永远不行。** 规格 §1 把「在远程目录里新建空文件」列为**永久非目标**：
 * SFTP 没有 `CREATE`，FTP 的 `STOR` 需要先有本地文件。
 *
 * 存在的意义是让界面**提前**把那个入口藏起来 ——
 * 但它**不是**唯一防线：`createNewItem` 里还有一道，
 * 因为快捷键与命令面板绕过了所有菜单。
 */
export function canCreateFileIn(directoryPath: string): boolean {
  return !isRemotePath(directoryPath);
}

/**
 * 这批目标目录里有没有远程的。
 *
 * 「新建文件」在**任何一个**目标是远程时都不可用 ——
 * 混选时本地那部分会建成功、远程那部分会失败，
 * 用户看到的「建了一半」比「压根不提供这个入口」糟糕得多。
 */
export function hasRemoteTarget(directoryPaths: string[]): boolean {
  return directoryPaths.some(directoryPath => isRemotePath(directoryPath));
}

/**
 * 这次「新建」在这些目录里能不能做。
 *
 * 「新建文件」在远程永远不行（永久非目标）；「新建目录」可以。
 *
 * 这是**唯一一处**能回答「这个新建动作可不可行」的地方 ——
 * 界面入口（菜单 / 工具栏）用它决定显不显示，
 * 对话框入口用它决定要不要当场拒绝，
 * 写侧用它决定走本地通道还是远程通道。
 */
export function canCreateItemIn(itemType: 'directory' | 'file', directoryPaths: string[]): boolean {
  if (itemType === 'file') {
    return !hasRemoteTarget(directoryPaths);
  }

  return true;
}

/**
 * 拼出「某个远程目录下的某个条目」的完整路径。
 *
 * 远程根（`sfm://remote/<连接id>`）也要能拼 ——
 * `parseRemotePath` 把它解析成 `remotePath = '/'`，
 * 拼的时候要还原成 `/<名字>` 而不是 `//<名字>`。
 */
export function buildRemoteChildPath(parentPath: string, name: string): string | null {
  const parsed = parseRemotePath(parentPath);

  if (!parsed) {
    return null;
  }

  return buildRemotePath(parsed.connectionId, `${parsed.remotePath}/${name}`);
}

/**
 * 在远程目录里新建一个目录。
 *
 * **不抛错**：失败原因进 `message`。
 * 抛错会让「权限不足」这种需要展示给用户的情况变成一次未捕获异常。
 */
export async function createRemoteDirectory(
  name: string,
  targetDirectoryPath: string,
): Promise<RemoteWriteResult> {
  const target = buildRemoteChildPath(targetDirectoryPath, name);

  if (!target) {
    return {
      ok: false,
      message: '这不是一个合法的远程目录路径。',
    };
  }

  try {
    await makeRemoteDirectory(target);

    return {
      ok: true,
      message: '',
    };
  }
  catch (error) {
    return {
      ok: false,
      message: describeRemoteError(error),
      kind: isRemoteErrorPayload(error) ? error.kind : undefined,
    };
  }
}

/**
 * 把一个远程条目在原目录内改名。
 *
 * **不抛错**：失败原因进 `message`。
 */
export async function renameRemoteEntry(
  entry: DirEntry,
  newName: string,
): Promise<RemoteWriteResult> {
  try {
    await renameRemotePath(entry.path, newName);

    return {
      ok: true,
      message: '',
    };
  }
  catch (error) {
    return {
      ok: false,
      message: describeRemoteError(error),
      kind: isRemoteErrorPayload(error) ? error.kind : undefined,
    };
  }
}

/**
 * 改名之后这个条目的新路径。
 *
 * 目标**恒在原目录内** —— 父目录取自源路径，而不是另算一遍。
 */
export function remotePathAfterRename(entryPath: string, newName: string): string | null {
  const parsed = parseRemotePath(entryPath);

  if (!parsed) {
    return null;
  }

  const lastSeparator = parsed.remotePath.lastIndexOf('/');
  const parent = lastSeparator <= 0 ? '/' : parsed.remotePath.slice(0, lastSeparator);

  return buildRemotePath(parsed.connectionId, `${parent}/${newName}`);
}
