// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-19：焦点在远程目录时，目录树切到远程目录树。
//
// 用户原话：点击处位于远程目录时，目录树可以同步切换显示远程目录树。
// 为此只改「根」——树的 `deps.readDir` 是 `resolveDirectoryContents`
// （`use-file-tree.ts` 的 `defaultDeps`），而那个函数*已经有远程分支*
// （`virtual-locations.ts` 的 `if (isRemotePath(path)) return readRemoteDirectory(path)`）。
// 测前远程树出不来，唯一的缺口是 `treeRootPaths` 里只有盘符。
//
// 把成纯函数是为了能测：这段判定原先内联在 `navigator.vue` 的 computed 里，
// 它要同时看「焦点路径 × 盘符列表 × 盘符标签 × 连接名表」四张表，内联就只能靠肉眼。
import {
  buildRemoteConnectionPath,
  buildRemotePath,
  normalizeRemotePath,
  parseRemotePath,
} from '@/utils/remote-paths';

/** 树根判定需要的连接信息。只取两样，其余一概不碰。 */
export interface TreeConnectionInfo {
  /** 连接名，用作树根标签。 */
  name: string;
  /**
   * 连接配置里的初始目录（远端路径，恒以 `/` 开头）。
   *
   * FORK-MODIFICATION 2026-10-19（用户第二次要求）：
   * 树根取**这个目录**，而不是连接根 `sfm://remote/<id>`。
   *
   * 上一轮我取连接根，理由是「根跟着焦点每跳一次就换，树会不停重建」。
   * 那个顾虑针对的是「当前目录」——它确实每跳一次就换。`initialPath` 不一样：
   * 它是连接配置里的**固定值**，只在换连接时才变，展开状态不会反复丢。
   * 而用户要看的正是他配的那个目录，而不是从 `/vol1` 一层层点下去。
   */
  initialPath?: string;
}

export interface TreeRootsInput {
  /** 焦点所在窗格的路径。分屏时是活跃 tab 的路径，单格时是当前目录。 */
  activePath: string | undefined;
  /** 本机盘符路径。 */
  drivePaths: readonly string[];
  /**
   * 盘符路径 → 标签（如 `C:/` → `Win (C:)`）。由调用方从 `drives` store 算好，
   * 卷标是 Rust 侧 `DriveInfo.name` 给的，本文件不重新推导，卷标信息得丢掉。
   */
  driveLabels: Readonly<Record<string, string>>;
  /** 连接 id → 连接名 / 初始目录。 */
  connectionsById: Readonly<Record<string, TreeConnectionInfo>>;
}

export interface TreeRootsResult {
  rootPaths: string[];
  rootLabels: Record<string, string>;
}

/**
 * 连接对应的树根：优先取配置里的 `initialPath`，取不到才退回连接根。
 *
 * `initialPath` 可能不存在（连接表还没加载完）、为空、或非法（`.` / `..` 段、
 * 连字符 id 之类），这些情况都退回连接根 —— 宁可根浅一点，也不要树变成空的。
 */
export function resolveRemoteTreeRoot(
  connectionId: string,
  initialPath?: string,
): string | null {
  const fallback = buildRemoteConnectionPath(connectionId);

  if (typeof initialPath !== 'string') {
    return fallback;
  }

  const normalized = normalizeRemotePath(initialPath);

  if (normalized === null) {
    return fallback;
  }

  // buildRemotePath 在连接 id 非法时返回 null；那种 id 上面的 fallback 也一定是
  // null（同一套校验），所以这里返回 fallback 即可，外层仍会判空。
  return buildRemotePath(connectionId, normalized) ?? fallback;
}

/**
 * 焦点在远程 → 根是那条连接的**配置目录**，标签是连接名。
 * 焦点不在远程（或 id 解析不出来）→ 回盘符列表，不让树变成空的。
 */
export function resolveTreeRoots(input: TreeRootsInput): TreeRootsResult {
  const remoteConnectionId = parseRemotePath(input.activePath ?? '')?.connectionId ?? null;
  const remoteRoot = remoteConnectionId
    ? resolveRemoteTreeRoot(remoteConnectionId, input.connectionsById[remoteConnectionId]?.initialPath)
    : null;

  if (!remoteConnectionId || !remoteRoot) {
    return {
      rootPaths: [...input.drivePaths],
      rootLabels: { ...input.driveLabels },
    };
  }

  const connectionName = input.connectionsById[remoteConnectionId]?.name?.trim();

  return {
    rootPaths: [remoteRoot],
    rootLabels: { [remoteRoot]: connectionName || remoteConnectionId },
  };
}
