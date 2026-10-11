// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 批量改名的前端类型定义。
//
// 这些类型与 `src-tauri/src/batch_rename/mod.rs` 里的 command 层 DTO 一一对应，
// Rust 侧全部标了 `#[serde(rename_all = "camelCase")]`，所以这里是 camelCase。
//
// **改名时两边必须同时改。** 这里不重复实现任何规则语义 ——
// 规则求值、冲突检测全部在 Rust 侧，前端只负责收集参数和展示结果。
// 之所以不在前端也实现一份预览，是为了避免「前后端求值不一致」
// （用户看到预览是 A，实际落盘变成 B，那比没有预览更危险）。

export type BatchRenameRuleType = 'findReplace' | 'caseTransform' | 'template' | 'sequence' | 'extension';

export type BatchRenameCaseMode = 'upper' | 'lower' | 'title' | 'camel' | 'snake' | 'kebab';

export type BatchRenameSortMode
  = | 'selection'
    | 'nameAsc'
    | 'nameDesc'
    | 'modifiedAsc'
    | 'modifiedDesc'
    | 'sizeAsc'
    | 'sizeDesc';

/** A：撞上批次外的已有文件；B：批次内多个条目生成同一个名字。 */
export type BatchRenameConflictKind = 'targetExists' | 'duplicateTarget';

export type BatchRenameInvalidNameReason
  = | 'empty'
    | 'illegalCharacter'
    | 'windowsReservedName'
    | 'trailingDotOrSpace';

export interface BatchRenameRuleEntry {
  name: string;
  parent: string;
  sizeBytes: number;
  modifiedMs: number;
}

/** 一条规则。`sequence` 的字段是平铺的 —— Rust 侧是内部标签的 newtype 变体。 */
export type BatchRenameRule
  = | {
    type: 'findReplace';
    find: string;
    replace: string;
    caseSensitive: boolean;
    includeExtension: boolean;
  }
  | {
    type: 'caseTransform';
    mode: BatchRenameCaseMode;
    includeExtension: boolean;
  }
  | {
    type: 'template';
    pattern: string;
  }
  | {
    type: 'sequence';
    start: number;
    step: number;
    pad: number;
  }
  | {
    type: 'extension';
    newExtension: string;
  };

export interface BatchRenamePlannedRename {
  path: string;
  oldName: string;
  newName: string;
  /** 大小写不敏感地与原名相同。这类条目不参与冲突、不会被执行。 */
  unchanged: boolean;
}

export interface BatchRenamePreviewRow {
  index: number;
  path: string;
  oldName: string;
  newName: string;
  changed: boolean;
  unchanged: boolean;
  /** 规则求值错误（如模板变量拼错）。出错时 newName 等于 oldName。 */
  error: string | null;
}

export interface BatchRenameNameConflict {
  kind: BatchRenameConflictKind;
  entryIndices: number[];
  targetName: string;
}

export interface BatchRenameInvalidName {
  entryIndex: number;
  targetName: string;
  reason: BatchRenameInvalidNameReason;
}

export interface BatchRenameConflictReport {
  conflicts: BatchRenameNameConflict[];
  invalidNames: BatchRenameInvalidName[];
  /** C 类：需要先改临时名腾空的条目索引。自动处理，不阻断。 */
  needsStaging: number[];
}

export interface BatchRenamePreviewResponse {
  directory: string;
  rows: BatchRenamePreviewRow[];
  report: BatchRenameConflictReport;
  /** conflicts 与 invalidNames 都为空时才为 true。 */
  executable: boolean;
}

export interface BatchRenameFailure {
  entryIndex: number;
  from: string;
  to: string;
  error: string;
}

export interface BatchRenameRollback {
  attempted: boolean;
  succeeded: boolean;
  error: string | null;
}

export interface BatchRenameExecutionReport {
  succeeded: BatchRenamePlannedRename[];
  failed: BatchRenameFailure[];
  rollback: BatchRenameRollback;
  totalOps: number;
  fullySuccessful: boolean;
  /** 只有完全成功时才有值。有它才能撤销。 */
  historyId: string | null;
  /** 文件已改完但历史没写进去 —— 这批改动将无法撤销，必须如实提示。 */
  historyError: string | null;
}

export interface BatchRenameHistoryItem {
  from: string;
  to: string;
}

export interface BatchRenameHistoryEntry {
  id: string;
  timestampMs: number;
  directory: string;
  items: BatchRenameHistoryItem[];
  itemCount: number;
}

export interface BatchRenameUndoReport {
  entryId: string;
  restoredCount: number;
  failed: string | null;
  /** 因目标名被占用而无法还原的文件名。 */
  blockedBy: string[];
  rollback: BatchRenameRollback;
  successful: boolean;
}
