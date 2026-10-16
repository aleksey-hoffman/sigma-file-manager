// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 需求反馈 3（2026-10-15）——目录内搜索递归化。
//
// 原来目录内搜索只是对 `read_dir` 拿到的那**一层**条目做内存过滤，所以搜子目录
// 里的文件永远搜不到。这里补一条递归通道，但刻意做成「粗筛 + 精筛」两段：
//
//   Rust 侧（search_directory_recursive）只做**文件名子串**粗筛 + 深度限制 +
//   条数上限，把磁盘遍历的成本压在本地，不把整棵目录树灌进 IPC；
//   前端仍然用既有的 matchesQuickSearch 对回传的 DirEntry 过一遍。
//
// 为什么不把全部谓词都下推到 Rust：目录内搜索支持 name: / path: / size: /
// items: / modified: 这些结构化谓词，其中 size / items / date 依赖
// 目录大小、条目数、格式化日期这些**前端 store** 状态（file-browser-entry-
// quick-search.ts 里那几个 haystack）。把它们复制一份到 Rust 只会得到两份
// 会漂移的语义。两段式让谓词语义仍然只有一处定义。
//
// 代价要说清楚：`size:>1MB` 这类**不含文件名关键词**的查询，粗筛阶段不会命中，
// 所以只能搜到当前层。这是「递归」与「全谓词」之间的取舍，不是遗漏。

import {
  onUnmounted, ref, shallowRef, watch, type Ref,
} from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';
import { clampFileBrowserSearchResultLimit } from '@/modules/navigator/components/file-browser/utils/file-browser-search-options';

// 与 stores/runtime/global-search.ts 的防抖同量级：太短会在每个按键上发起一次
// 磁盘遍历，太长会让人觉得「没反应」。
const RECURSIVE_SEARCH_DEBOUNCE_MS = 250;

// 磁盘遍历的结果没有天然上界，必须截断，否则一个十万文件的目录树会把 IPC 通道灌满。
//
// FORK-MODIFICATION: 需求反馈 2（2026-10-16）——这个 500 原本是写死的，
// 而全局搜索早就有「结果条数上限」旋钮（userSettings.globalSearch.resultLimit）。
// 同一个含义两个数字，用户在全局搜索里调到 50，目录内搜索照样捞 500 条，就是「不统一」。
// 现在改成从设置注入，取值口统一走 clampFileBrowserSearchResultLimit。
const RECURSIVE_SEARCH_LIMIT_FALLBACK = 500;

interface RecursiveSearchEntry {
  name: string;
  ext: string | null;
  path: string;
  size: number;
  item_count: number | null;
  modified_time: number;
  accessed_time: number;
  created_time: number;
  mime: string | null;
  is_file: boolean;
  is_dir: boolean;
  is_symlink: boolean;
  is_hidden: boolean;
}

function toDirEntry(raw: RecursiveSearchEntry): DirEntry {
  return {
    name: raw.name,
    ext: raw.ext ?? null,
    path: raw.path,
    size: raw.size ?? 0,
    item_count: raw.item_count ?? null,
    modified_time: raw.modified_time ?? 0,
    accessed_time: raw.accessed_time ?? 0,
    created_time: raw.created_time ?? 0,
    mime: raw.mime ?? null,
    is_file: Boolean(raw.is_file),
    is_dir: Boolean(raw.is_dir),
    is_symlink: Boolean(raw.is_symlink),
    is_hidden: Boolean(raw.is_hidden),
  };
}

export function useFileBrowserRecursiveSearch(options: {
  currentPath: Ref<string>;
  filterQuery: Ref<string>;
  maxDepth: Ref<number>;
  // FORK-MODIFICATION: 需求反馈 2 —— 结果条数上限，来自 globalSearch.resultLimit。
  resultLimit?: Ref<number>;
  // FORK-MODIFICATION: 2026-10-16 —— 容错开关。传下去让 Rust 粗筛在子串没命中时
  // 也算一次相似度，否则「拼写容错」在目录内搜索里会是个点了没反应的假开关。
  typoTolerance?: Ref<boolean>;
}) {
  // 递归命中项。与当前目录的条目并存在同一个列表里，所以对外仍叫 entries。
  const recursiveMatches = shallowRef<DirEntry[]>([]);
  const isRecursiveSearching = ref(false);
  // 远程通道不可用时（命令缺失、权限错误、目录不可读）静默降级为「只搜当前层」，
  // 不打断用户正在输入的过滤。
  const recursiveSearchUnavailable = ref(false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  // 单调递增的请求序号。invoke 没有 AbortController，早返回的旧响应必须被丢弃，
  // 否则「先输 a 再输 ab」会让 a 的结果覆盖 ab 的结果。
  let requestSequence = 0;

  function cancelPendingSearch() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    requestSequence += 1;
  }

  async function runSearch(rootPath: string, query: string, sequence: number) {
    isRecursiveSearching.value = true;

    // 上限在**每次请求时**读，而不是只在 setup 时读一次：用户在搜索结果还开着的时候
    // 把上限调小，下一次按键就应该按新上限走。缓存成常量会让旋钮看起来「时灵时不灵」。
    const limit = clampFileBrowserSearchResultLimit(
      options.resultLimit?.value ?? RECURSIVE_SEARCH_LIMIT_FALLBACK,
    );

    try {
      const rawResults = await invoke<RecursiveSearchEntry[]>('search_directory_recursive', {
        rootPath,
        query,
        maxDepth: options.maxDepth.value,
        limit,
        typoTolerance: options.typoTolerance?.value ?? false,
      });

      if (sequence !== requestSequence) {
        return;
      }

      recursiveMatches.value = (rawResults ?? []).map(toDirEntry);
      recursiveSearchUnavailable.value = false;
    }
    catch {
      // 目录不可读、命令不存在、参数不对……都走这里。降级成本地一层过滤。
      if (sequence !== requestSequence) {
        return;
      }

      recursiveMatches.value = [];
      recursiveSearchUnavailable.value = true;
    }
    finally {
      if (sequence === requestSequence) {
        isRecursiveSearching.value = false;
      }
    }
  }

  function scheduleSearch(rootPath: string, query: string) {
    cancelPendingSearch();

    const sequence = requestSequence;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void runSearch(rootPath, query, sequence);
    }, RECURSIVE_SEARCH_DEBOUNCE_MS);
  }

  watch(
    [options.currentPath, options.filterQuery],
    ([rootPath, query]) => {
      const trimmedQuery = query.trim();

      // 目录变了必须清空：旧目录的递归命中项在新目录里没有意义。
      // 空查询不发请求，保留空数组即可。
      if (!rootPath || !trimmedQuery) {
        cancelPendingSearch();
        recursiveMatches.value = [];
        return;
      }

      scheduleSearch(rootPath, trimmedQuery);
    },
    { immediate: true },
  );

  onUnmounted(cancelPendingSearch);

  return {
    recursiveMatches,
    isRecursiveSearching,
    recursiveSearchUnavailable,
    cancelPendingSearch,
  };
}
