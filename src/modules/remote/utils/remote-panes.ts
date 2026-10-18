// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 打开一个远程位置时，标签组该摆成什么样。
//
// **纯函数，与工作区 store 完全解耦。** 这样「要不要摆双屏」这个判断能被
// 单测钉死，而不必去驱动整个导航器 —— 分屏是工作区的核心共享机制，
// 为了一个判断去改它并靠肉眼验收，风险与收益不成比例。
//
// ⚠️ **阶段 1 没有调用方，这是有意的。**
// 打开远程位置需要 `remote_read_dir`，它要到阶段 2 接上真实协议栈才存在；
// 现在既没有入口，也没有能验收的界面。
// 阶段 2 接 FTP 时，在「打开远程路径」的那一处调用 `resolveRemoteOpenPanes`，
// 按返回的数组开一组标签页即可 —— 判定逻辑已经在这里且已被测过。
//
// 分屏在本项目的表示：**一组标签页多于一个即分屏**，每格是一个带
// `paneWidth` 的 Tab（见 `stores/storage/workspaces.ts` 的 `enableSplitView`）。
// 所以「左本地右远端」就是 `[本地, 远端]` 这个顺序，不能反。

import type { RemoteConnection } from '@/types/remote';
import { hasRemoteLocalPath } from '@/types/remote';
import { parseRemotePath } from '@/utils/remote-paths';

/** 一格标签页要显示的路径。 */
export interface RemotePaneSpec {
  path: string;
  /** 这一格的角色，给调用方排版与写日志用。 */
  role: 'local' | 'remote';
}

/**
 * 算出打开一个路径时该摆哪几格。
 *
 * 规则只有一条，但有几个容易踩的边界：
 * - **不是远程路径** → 单格原样返回。调用方本来就在处理本地路径，
 *   这里不该改变任何行为。
 * - **远程路径但连接不存在** → 单格原样返回，并让调用方报「连接不存在」。
 *   绝不因为查不到连接就退化成空数组，那会让标签页开不出来。
 * - **连接没有本地目录** → 单格。绝大多数用户属于这一类。
 * - **本地目录和远端路径一样** → 仍然返回两格。让用户自己看出来
 *   「我填了两遍同一个路径」，比替他猜着合并掉要好。
 */
export function resolveRemoteOpenPanes(
  path: string,
  connections: readonly RemoteConnection[],
): RemotePaneSpec[] {
  const single: RemotePaneSpec[] = [{
    path,
    role: 'remote',
  }];
  const parsed = parseRemotePath(path);

  if (parsed === null) {
    return single;
  }

  const connection = connections.find(item => item.id === parsed.connectionId);

  if (!connection || !hasRemoteLocalPath(connection)) {
    return single;
  }

  const localPath = (connection.localPath ?? '').trim();

  return [
    {
      path: localPath,
      role: 'local',
    },
    {
      path,
      role: 'remote',
    },
  ];
}

/**
 * 这一组该不该摆成双屏。
 *
 * 单独拎出来是因为调用方要拿它决定「要不要新建一个标签组」——
 * 已经开着远程标签时再开一组，不如在当前格里切目录。
 */
export function shouldOpenRemoteAsSplit(
  path: string,
  connections: readonly RemoteConnection[],
): boolean {
  return resolveRemoteOpenPanes(path, connections).length > 1;
}
