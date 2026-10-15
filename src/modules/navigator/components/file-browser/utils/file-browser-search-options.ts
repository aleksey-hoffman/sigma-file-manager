// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 需求反馈 2（2026-10-16）——目录内搜索与全局搜索的选项统一。
//
// 全局搜索一直有「显示文件 / 显示目录 / 精确匹配 / 结果条数上限」四个选项，
// 目录内搜索只有裸词 + 结构化谓词，于是同一个开关在两个界面有两种行为。
// 这里把这四个选项的**语义**收敛到一处纯函数里，两个界面都从这里取判据，
// 保证「统一」不是两句口号而是同一段代码。
//
// 为什么是纯函数而不是直接读 store：判据本身要能单测。读 store 的版本只能靠
// mount 组件来验，一旦断言失败分不清是判据写错了还是 store 没接上。

import type { DirEntry } from '@/types/dir-entry';
import { SEARCH_CONSTANTS } from '@/constants';

/** 目录内搜索「结果条数上限」的兜底值。用户设置里该字段缺失或非法时用它。 */
export const FILE_BROWSER_SEARCH_RESULT_LIMIT_DEFAULT = SEARCH_CONSTANTS.DEFAULT_RESULT_LIMIT;

/**
 * 把任意输入夹到合法的结果条数区间。
 *
 * NumberField 组件允许用户手打到框外（比如粘贴 9999），全局搜索那边是自己夹一遍的；
 * 目录内搜索如果直接采信这个值，就会在递归通道上发起一个 9999 条的遍历 ——
 * 一次「删掉一个 0」的操作变成一次大目录树扫描。所以夹取必须放在**取值口**，
 * 而不是放在 UI 层。
 */
export function clampFileBrowserSearchResultLimit(value: unknown): number {
  const numeric = Math.floor(Number(value));

  if (!Number.isFinite(numeric)) {
    return FILE_BROWSER_SEARCH_RESULT_LIMIT_DEFAULT;
  }

  return Math.max(
    SEARCH_CONSTANTS.MIN_RESULT_LIMIT,
    Math.min(SEARCH_CONSTANTS.MAX_RESULT_LIMIT, numeric),
  );
}

export interface FileBrowserSearchKindOptions {
  includeFiles: boolean;
  includeDirectories: boolean;
}

/**
 * 「显示文件 / 显示目录」两个开关的合并判据。
 *
 * 两个开关都关掉时返回 true 而不是 false：空集会让用户看到「0 项结果」且没有任何
 * 线索说明是自己把结果全关掉了。这里选择放行全部条目，让结果列表保持可见，
 * 属于「无效配置按无害处理」而不是「按字面执行然后让界面变成空白」。
 */
export function isEntryAllowedBySearchKind(
  entry: DirEntry,
  options: FileBrowserSearchKindOptions,
): boolean {
  if (!options.includeFiles && !options.includeDirectories) {
    return true;
  }

  // 符号链接指向目录时 is_dir 可能为 false，一律按「目录类条目」判定，
  // 否则关掉「显示目录」会把符号链接也一起清掉，用户会觉得凭空少了东西。
  const isDirectoryLike = entry.is_dir;

  return isDirectoryLike ? options.includeDirectories : options.includeFiles;
}

/**
 * 「精确匹配」在目录内搜索里的判据。
 *
 * 只对**裸词**生效：带 `size:` / `path:` 这类结构化谓词前缀的查询不参与，
 * 因为那些谓词本身就带自己的比较语义（>=、.. 区间），再叠一层全等只会让查询无法表达。
 *
 * 命中条件刻意比「名字全等」宽一档：扩展名全等也算命中，且允许带点（`.png`），
 * 与关闭精确匹配时的后缀匹配（`entryNameHaystackIncludes` 里 `'.png'.includes(q)`）
 * 在方向上保持一致 —— 用户输入 `.png` 在两种模式下都应该能命中 `a.png`。
 */
export function fileBrowserEntryMatchesExactSearch(
  entry: DirEntry,
  valueNormalized: string,
): boolean {
  if (!valueNormalized) {
    return true;
  }

  if (entry.name.toLowerCase() === valueNormalized) {
    return true;
  }

  if (entry.ext) {
    const extensionLower = entry.ext.toLowerCase();

    if (extensionLower === valueNormalized || `.${extensionLower}` === valueNormalized) {
      return true;
    }
  }

  return false;
}

/**
 * 结果条数上限的截断。
 *
 * 返回 `slice` 而不是就地改数组：entries 是 computed 的产物，就地截断会让下游
 * （排序、统计）看到同一个数组被改过，两次求值结果不一致。
 */
export function limitFileBrowserSearchResults<T>(entries: T[], resultLimit: number): T[] {
  const limit = clampFileBrowserSearchResultLimit(resultLimit);

  if (entries.length <= limit) {
    return entries;
  }

  return entries.slice(0, limit);
}
