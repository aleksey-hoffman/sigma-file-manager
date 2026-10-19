// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 传输类右键菜单项的可见性判定。
//
// 为什么单独成文件：这三个动作的前提不是「选中的是不是远程条目」，
// 而是**对面还有没有一格**——
//
// - 「上传到远程」：选中的必须是**本地**条目，且对面要有一格**远程**目录；
// - 「下载到本地」：选中的必须是**远程**条目，且对面要有一格**本地**目录；
// - 「权限设置」：选中的必须是**远程**条目，且该连接**支持改权限**（只有 SFTP）。
//
// 所以判定需要「对面那一格在哪儿」这个上下文，它不属于条目策略那一层。

import type { DirEntry } from '@/types/dir-entry';
import { isRemotePath, parseRemotePath } from '@/utils/remote-paths';
import type { RemoteProtocol } from '@/types/remote';

export type RemoteTransferMenuAction = 'upload-to-remote' | 'download-to-local' | 'remote-permissions';

export const REMOTE_TRANSFER_MENU_ACTIONS: readonly RemoteTransferMenuAction[] = [
  'upload-to-remote',
  'download-to-local',
  'remote-permissions',
];

/** 只有 SFTP 能改权限。FTP / FTPS 没有可靠的权限位，菜单项要**置灰/隐藏**而不是报错。 */
export function protocolSupportsPermissions(protocol: RemoteProtocol | undefined): boolean {
  return protocol === 'sftp';
}

export interface RemoteTransferVisibilityOptions {
  /** 对面那一格是不是远程目录（上传的目标）。 */
  hasRemoteCounterpart: boolean;
  /** 对面那一格是不是本地目录（下载的目标）。 */
  hasLocalCounterpart: boolean;
  /**
   * 选中条目所在连接的协议。用于判定能不能改权限。
   * 多选且跨了不同连接时，**取最严格的那个**（见 `resolveSelectionProtocol`）。
   */
  selectionProtocol?: RemoteProtocol;
}

/**
 * 多选条目分属不同连接时的协议。
 *
 * 混选时取**最严格**的：只要有一个连接不支持改权限，整个动作就该不可用 ——
 * 对一部分条目能做、对另一部分不能做，界面说不清楚，用户会以为坏了。
 */
export function resolveSelectionProtocol(
  entries: DirEntry[],
  getProtocol: (connectionId: string) => RemoteProtocol | undefined,
): RemoteProtocol | undefined {
  let resolved: RemoteProtocol | undefined;

  for (const entry of entries) {
    const parsed = parseRemotePath(entry.path);

    if (!parsed) {
      continue;
    }

    const protocol = getProtocol(parsed.connectionId);

    if (!protocol) {
      continue;
    }

    if (!resolved) {
      resolved = protocol;
      continue;
    }

    if (resolved !== protocol) {
      // 混了不同协议：只要有一个不支持，就整体不支持。
      if (!protocolSupportsPermissions(protocol) || !protocolSupportsPermissions(resolved)) {
        return 'ftp';
      }
    }
  }

  return resolved;
}

/** 选中的条目是不是**全部**在远程。 */
export function areAllRemoteEntries(entries: DirEntry[]): boolean {
  return entries.length > 0 && entries.every(entry => isRemotePath(entry.path));
}

/** 选中的条目是不是**全部**在本地。 */
export function areAllLocalEntries(entries: DirEntry[]): boolean {
  return entries.length > 0 && entries.every(entry => !isRemotePath(entry.path));
}

/**
 * 这三个动作现在该不该出现。
 *
 * 返回 `false` 的场合一律是**「不该让用户点」**：没有对面那一格、
 * 选的不是那一侧的条目、或者协议不支持。菜单项不出现，好过点下去弹一句
 * 「请先打开一个远程目录」。
 */
export function isRemoteTransferActionVisible(
  action: RemoteTransferMenuAction,
  entries: DirEntry[],
  options: RemoteTransferVisibilityOptions,
): boolean {
  if (entries.length === 0) {
    return false;
  }

  if (action === 'upload-to-remote') {
    return areAllLocalEntries(entries) && options.hasRemoteCounterpart;
  }

  if (action === 'download-to-local') {
    return areAllRemoteEntries(entries) && options.hasLocalCounterpart;
  }

  // 'remote-permissions'
  //
  // **只对单选开放**。后端 `remote_chmod` 收的是**一个**路径，
  // 多选时前端只能挑第一个去改 —— 菜单项还显示着，用户却以为
  // 选中的那几个都被改了。宁可不显示，也不做「改了一半」的事。
  // 目录内部的整棵子树由对话框里的「同时应用到子目录」负责，
  // 不需要多选。
  return entries.length === 1
    && areAllRemoteEntries(entries)
    && protocolSupportsPermissions(options.selectionProtocol);
}
