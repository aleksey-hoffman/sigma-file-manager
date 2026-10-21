// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 「比较并同步」的纯函数工具。
//
// 这一层**不碰组件、不碰 tauri**，所以可以逐条单测。

import type {
  CompareCriteria,
  CompareLocation,
  CompareNode,
  CompareStatus,
} from '@/types/compare-sync';
import { isRemotePath, parseRemotePath } from '@/utils/remote-paths';

/** 默认准则：按时间 + 按大小。 */
export function defaultCompareCriteria(): CompareCriteria {
  return {
    byTime: true,
    bySize: true,
    byChecksum: false,
    caseSensitive: true,
    remoteTimeOffsetSeconds: 0,
    recursive: true,
    maxDepth: null,
    excludePatterns: [],
  };
}

/**
 * 把面板上的路径变成比较的一侧。
 *
 * 远程路径（`sfm://remote/<连接id>/<远端路径>`）拆成「连接 id + 远端路径」，
 * 其余一律当本地路径。**路径非法时返回 `null`** —— 宁可让界面报「这个路径
 * 用不了」，也不要拿一个半截的路径去比较然后报一句看不懂的错。
 */
export function toCompareLocation(path: string): CompareLocation | null {
  const trimmed = path.trim();

  if (!trimmed) {
    return null;
  }

  if (isRemotePath(trimmed)) {
    const parsed = parseRemotePath(trimmed);

    if (!parsed) {
      return null;
    }

    return {
      type: 'remote',
      connectionId: parsed.connectionId,
      path: parsed.remotePath,
    };
  }

  return {
    type: 'local',
    path: trimmed,
  };
}

/** 一侧在界面上的显示名。 */
export function compareLocationLabel(location: CompareLocation): string {
  if (location.type === 'remote') {
    return `sfm://remote/${location.connectionId}${location.path}`;
  }

  return location.path;
}

/**
 * 按状态过滤差异树，**保留层级**。
 *
 * 一个节点在两种情况下留下：它自己命中筛选条件，或者它有后代命中。
 * 后者不能省 —— 命中的是 `sub/a.txt` 时，`sub` 这层目录必须留着，
 * 否则用户看到的是一堆没有上下文的孤立文件。
 */
export function filterCompareNodes(
  nodes: CompareNode[],
  predicate: (node: CompareNode) => boolean,
): CompareNode[] {
  const result: CompareNode[] = [];

  for (const node of nodes) {
    const children = filterCompareNodes(node.children ?? [], predicate);

    if (predicate(node) || children.length > 0) {
      result.push({
        ...node,
        children,
      });
    }
  }

  return result;
}

/** 按状态计数（含所有层级）。 */
export function countStatuses(nodes: CompareNode[]): Record<CompareStatus, number> {
  const counts: Record<CompareStatus, number> = {
    same: 0,
    only_left: 0,
    only_right: 0,
    newer: 0,
    older: 0,
    size_diff: 0,
    content_diff: 0,
    kind_diff: 0,
    indeterminate: 0,
  };

  function walk(list: CompareNode[]) {
    for (const node of list) {
      counts[node.status] += 1;
      walk(node.children ?? []);
    }
  }

  walk(nodes);

  return counts;
}

/** 是否属于「方向待定」—— 需要用户自己决定往哪边同步。 */
export function isUndecidedStatus(status: CompareStatus): boolean {
  return status === 'size_diff'
    || status === 'content_diff'
    || status === 'kind_diff'
    || status === 'indeterminate';
}

/** 排除掩码：一行一条，空行与首尾空白忽略。 */
export function parseExcludePatterns(text: string): string[] {
  return text
    .split(/[\r\n]+/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/** 把排除掩码写回多行文本。 */
export function formatExcludePatterns(patterns: string[]): string {
  return patterns.join('\n');
}

/**
 * 一个节点在差异树里占多高（用于缩进）。
 *
 * 用**扁平后的深度**而不是递归渲染时的层数：筛选之后父子关系可能断开，
 * 按渲染层数缩进会让同一条路径在不同筛选条件下缩进量不一样。
 */
export function compareNodeDepths(nodes: CompareNode[]): Map<string, number> {
  const depths = new Map<string, number>();

  function walk(list: CompareNode[], depth: number) {
    for (const node of list) {
      depths.set(node.relPath, depth);
      walk(node.children ?? [], depth + 1);
    }
  }

  walk(nodes, 0);

  return depths;
}
