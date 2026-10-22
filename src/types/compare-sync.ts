// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 「比较并同步」的前端数据契约。
//
// 与 `src-tauri/src/compare/` 的 serde 输出**逐字段对应**。
// 后端改了字段名而这里没跟上，表现是「界面全空但不报错」，
// 所以两边必须一起改。

/** 比较的一侧。本地是路径，远程是「连接 id + 远端路径」。 */
export type CompareLocation
  = | {
    type: 'local';
    path: string;
  }
  | {
    type: 'remote';
    connectionId: string;
    path: string;
  };

/** 条目种类。 */
export type CompareEntryKind = 'file' | 'directory' | 'symlink' | 'other';

/**
 * 比较结果。
 *
 * `newer` / `older` 是**相对左侧**说的：左侧比右侧新 → `newer`。
 * `size_diff` / `content_diff` / `kind_diff` / `indeterminate`
 * 都是「方向待定」，同步时只进跳过清单，不自动覆盖。
 */
export type CompareStatus
  = | 'same'
    | 'only_left'
    | 'only_right'
    | 'newer'
    | 'older'
    | 'size_diff'
    | 'content_diff'
    | 'kind_diff'
    | 'indeterminate';

/** 同步方向。 */
export type CompareDirection = 'none' | 'to_right' | 'to_left' | 'indeterminate';

/** 一个条目的元数据。 */
export interface CompareEntryMeta {
  name: string;
  kind: CompareEntryKind;
  size: number;
  /** Unix 纪元毫秒。 */
  modifiedTime: number;
}

/** 差异树里的一个节点。 */
export interface CompareNode {
  name: string;
  /** 相对根目录的路径，用 `/` 分隔。 */
  relPath: string;
  kind: CompareEntryKind;
  status: CompareStatus;
  direction: CompareDirection;
  left: CompareEntryMeta | null;
  right: CompareEntryMeta | null;
  children: CompareNode[];
}

/** 差异统计。 */
export interface CompareStats {
  total: number;
  same: number;
  onlyLeft: number;
  onlyRight: number;
  newer: number;
  older: number;
  sizeDiff: number;
  contentDiff: number;
  kindDiff: number;
  indeterminate: number;
  excluded: number;
  /** **读不了**的目录数。这些目录被跳过，比较继续。 */
  unreadable: number;
  /** 取不到元数据而跳过的条目数。 */
  skipped: number;
}

/** 差异树。 */
export interface CompareTree {
  nodes: CompareNode[];
  stats: CompareStats;
}

/** 比较准则。 */
export interface CompareCriteria {
  byTime: boolean;
  bySize: boolean;
  byChecksum: boolean;
  caseSensitive: boolean;
  /** 远端时间的偏移（秒），把服务器本地时间换算到本机时区。 */
  remoteTimeOffsetSeconds: number;
  recursive: boolean;
  /** 最大递归深度；`null` = 不限。 */
  maxDepth: number | null;
  excludePatterns: string[];
}

/** 比较命令的返回。 */
export interface CompareResponse {
  tree: CompareTree;
  leftLabel: string;
  rightLabel: string;
}

/** 一个同步动作。 */
export type CompareSyncAction
  = | {
    action: 'create_dir';
    relPath: string;
    target: CompareLocation;
  }
  | {
    action: 'transfer_file';
    relPath: string;
    source: CompareLocation;
    target: CompareLocation;
  }
  | {
    action: 'skip';
    relPath: string;
    reason: 'indeterminate';
  };

/** 同步计划的统计。 */
export interface CompareSyncPlanStats {
  createDirs: number;
  transferFiles: number;
  skipped: number;
}

/** 同步计划。 */
export interface CompareSyncPlan {
  actions: CompareSyncAction[];
  stats: CompareSyncPlanStats;
}

/** 预览同步计划的返回。 */
export interface ComparePlanResponse {
  plan: CompareSyncPlan;
  stats: CompareStats;
}

/** 进度事件载荷。 */
export interface CompareSyncJobProgressPayload {
  jobId: string;
  percent: number;
  detail: string;
  processed: number;
  total: number;
}

/**
 * 比较阶段的进度事件载荷。
 *
 * **载荷里没有文案** —— 文案由界面按 `phase` / `side` 本地化，
 * 这样 17 个语言包都能说人话。
 */
export interface CompareProgressPayload {
  jobId: string;
  /** `scanning`（收集）/ `comparing`（判定）/ `done`（完成）。 */
  phase: 'scanning' | 'comparing' | 'done';
  /** 收集阶段是哪一侧：`left` / `right`；判定与完成阶段是空串。 */
  side: 'left' | 'right' | '';
  /** 0..=100。 */
  percent: number;
  /** 已扫描的条目数。 */
  scanned: number;
  /** 总量。收集阶段还不知道，是 0。 */
  total: number;
}

/** 一次失败。 */
export interface CompareSyncFailure {
  relPath: string;
  message: string;
}

/** 执行结果。 */
export interface CompareSyncRunReport {
  transferredFiles: number;
  createdDirs: number;
  skipped: number;
  failed: number;
  cancelled: boolean;
  failures: CompareSyncFailure[];
}

/** 完成事件载荷。 */
export interface CompareSyncJobFinishedPayload {
  jobId: string;
  cancelled: boolean;
  success: boolean;
  error: string | null;
  report: CompareSyncRunReport | null;
}
