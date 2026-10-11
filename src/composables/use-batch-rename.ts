// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { ref, watch, type Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type {
  BatchRenameExecutionReport,
  BatchRenameHistoryEntry,
  BatchRenamePreviewResponse,
  BatchRenameRule,
  BatchRenameRuleEntry,
  BatchRenameSortMode,
  BatchRenameUndoReport,
} from '@/types/batch-rename';

/**
 * 本地时间相对 UTC 的分钟数（东八区为 `+480`）。
 *
 * `Date.getTimezoneOffset()` 的符号是**反的**：东八区返回 `-480`，
 * 而 Rust 侧要的是「本地时间减 UTC」，所以这里取负。
 *
 * 少了这个换算，模板里的 `{date}` 在东八区会比实际日期早一天。
 */
export function getUtcOffsetMinutes(): number {
  const offsetMinutes = new Date().getTimezoneOffset();

  // 直接取负会在 UTC 主机上产出 `-0`。它在算术上等于 0，但 `Object.is(-0, 0)`
  // 是 false，会让「UTC 环境应当返回 0」这类断言莫名其妙地红。
  return offsetMinutes === 0 ? 0 : -offsetMinutes;
}

/**
 * 预览防抖间隔。
 *
 * 每次按键都 invoke 一次的话，改一个模板要打十几次 IPC；
 * 而预览只是本地纯计算 + 读一次目录，太快反而让人看不清中间态。
 */
const PREVIEW_DEBOUNCE_MS = 200;

export async function previewBatchRename(params: {
  directory: string;
  entries: BatchRenameRuleEntry[];
  rules: BatchRenameRule[];
  sort: BatchRenameSortMode;
}): Promise<BatchRenamePreviewResponse> {
  return invoke('batch_rename_preview', {
    directory: params.directory,
    entries: params.entries,
    rules: params.rules,
    sort: params.sort,
    utcOffsetMinutes: getUtcOffsetMinutes(),
  });
}

export async function executeBatchRename(params: {
  directory: string;
  entries: PreviewRowForExecution[];
}): Promise<BatchRenameExecutionReport> {
  return invoke('batch_rename_execute', {
    directory: params.directory,
    entries: params.entries,
  });
}

/** execute 只接受这些字段，直接复用预览行会多传一堆 UI 用不到的东西。 */
export type PreviewRowForExecution = {
  path: string;
  oldName: string;
  newName: string;
  unchanged: boolean;
};

export async function loadBatchRenameHistory(): Promise<BatchRenameHistoryEntry[]> {
  return invoke('batch_rename_history');
}

export async function undoBatchRename(id: string): Promise<BatchRenameUndoReport> {
  return invoke('batch_rename_undo', { id });
}

/** 取目录名，用作模板里的 `{parent}`。没有目录段时返回空串。 */
export function getDirectoryName(directory: string): string {
  const parts = directory.split(/[/\\]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

/**
 * 把前端的 `DirEntry` 转成 Rust 侧的 `RuleEntry`。
 *
 * `modified_time` 已经是**毫秒**（Rust 侧 `metadata_times_unix_ms`），
 * 与 `RuleEntry.modified_ms` 同单位，不要再乘 1000。
 */
export function toBatchRenameRuleEntries(
  entries: DirEntry[],
  directory: string,
): BatchRenameRuleEntry[] {
  const parent = getDirectoryName(directory);

  return entries.map(entry => ({
    name: entry.name,
    parent,
    sizeBytes: Number(entry.size ?? 0),
    modifiedMs: Number(entry.modified_time ?? 0),
  }));
}

export interface UseBatchRenamePreviewOptions {
  directory: Ref<string>;
  entries: Ref<DirEntry[]>;
  rules: Ref<BatchRenameRule[]>;
  sort: Ref<BatchRenameSortMode>;
}

/**
 * 规则改动 → 自动重算预览。
 *
 * 预览是破坏性操作的唯一安全网，所以必须实时跟手：
 * 用户改一个字符就要立刻看到后果，而不是点「预览」按钮。
 */
export function useBatchRenamePreview(options: UseBatchRenamePreviewOptions) {
  const preview = ref<BatchRenamePreviewResponse | null>(null);
  const isPreviewing = ref(false);
  const previewError = ref<string | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  // 每次请求自增，用于丢弃过期响应。防抖已经能挡住大部分情况，
  // 但一次慢请求完全可能后发先至，导致预览显示的是旧规则的结果。
  let requestId = 0;

  async function refresh(): Promise<void> {
    const currentRequestId = ++requestId;

    if (options.rules.value.length === 0 || options.entries.value.length === 0) {
      preview.value = null;
      previewError.value = null;
      return;
    }

    isPreviewing.value = true;
    previewError.value = null;

    try {
      const result = await previewBatchRename({
        directory: options.directory.value,
        entries: toBatchRenameRuleEntries(options.entries.value, options.directory.value),
        rules: options.rules.value,
        sort: options.sort.value,
      });

      if (currentRequestId !== requestId) {
        return;
      }

      preview.value = result;
    }
    catch (error) {
      if (currentRequestId !== requestId) {
        return;
      }

      preview.value = null;
      previewError.value = error instanceof Error ? error.message : String(error);
    }
    finally {
      if (currentRequestId === requestId) {
        isPreviewing.value = false;
      }
    }
  }

  function scheduleRefresh(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void refresh();
    }, PREVIEW_DEBOUNCE_MS);
  }

  watch(
    () => [options.directory.value, options.rules.value, options.sort.value],
    () => {
      scheduleRefresh();
    },
    { deep: true },
  );

  return {
    preview,
    isPreviewing,
    previewError,
    refresh,
    /** 对话框关闭时调用，避免残留的定时器在后台继续 invoke。 */
    cancelScheduledRefresh(): void {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      requestId += 1;
    },
  };
}
