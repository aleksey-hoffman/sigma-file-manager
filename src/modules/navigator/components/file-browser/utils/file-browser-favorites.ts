// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 用户反馈（2026-10-16）——右键「添加到收藏」增加分类选择步骤。
//
// 这两个函数是那次改动的**全部决策逻辑**，其余都是接线。把它们从
// use-file-browser-selection.ts 与 file-browser.vue 里抽出来，是因为：
//
//   1. 原先的写法里，「加收藏走对话框 / 取消收藏直接做」这个分支和十二个 store
//      的初始化写在同一个函数里，要测它就得把整个 FileBrowser mount 起来；
//   2. 更要紧的是「重名的新分类名落回未分类」这条 —— 它是个**静默降级**，
//      不出错、不提示，条目照样进了收藏但分类是「未分类」。这种分支必须能直接断言。
//
// 抽成纯函数 + 依赖注入之后，上面两条都能用普通单测守住，成本不到原来的十分之一。

import type { DirEntry } from '@/types/dir-entry';

/**
 * 「添加到收藏」是否要先弹分类对话框。
 *
 * 判定用 `every` 而不是「有没有一个不是收藏」：一批条目里只要有一个还没收藏，
 * 这次点击的语义就是「加收藏」，必须走对话框。反过来（一部分已收藏、一部分没有）
 * 也要走 —— 用户看到的是「有的没收藏」，他要的是把缺的那几个补上。
 *
 * 空数组返回 true（`[].every` 的语义），于是 `toggleFavorites([])` 会落到取消分支，
 * 那是个空操作，不会有副作用。这里保留 `every` 的原生语义而不是加特判，
 * 是因为加特判会让「空输入」和「全部已收藏」在行为上分叉，而两者对用户没有区别。
 */
export function shouldOpenFavoriteCategoryDialog(
  entries: DirEntry[],
  isFavorite: (path: string) => boolean,
): boolean {
  return !entries.every(entry => isFavorite(entry.path));
}

export interface FavoriteCategorySelectionDeps {
  /** 已收藏判定。用来跳过已经收藏过的条目，避免重复写。 */
  isFavorite: (path: string) => boolean;
  /** 新建分类，返回新分类对象；重名或非法名时返回 null。 */
  createFavoriteCategory: (name: string) => { id: string } | null;
  /** 写入收藏。categoryId 为 null 表示「未分类」。 */
  addToFavorites: (path: string, isFile: boolean, categoryId: string | null) => void;
}

export interface FavoriteCategorySelectionResult {
  /** 实际使用的分类 id；未分类时为 null。 */
  categoryId: string | null;
  /** 本次是否新建了一个分类。 */
  createdCategory: boolean;
  /** 真正写入收藏的条目数（跳过已收藏的之后）。 */
  addedCount: number;
}

/**
 * 解析用户在分类对话框里的选择并写入收藏。
 *
 * 三条决策，顺序不能换：
 *
 * 1. **新分类名优先于下拉选择**。用户填了名字就是要一个叫这个名字的新分类，
 *    忽略掉它、静默落进下拉里选的那个分类，是把用户的显式输入当没看见。
 * 2. **重名导致 `createFavoriteCategory` 返回 null 时落到「未分类」，而不是中断**。
 *    这一批条目是用户明确点了「收藏」的，卡住不写比写进未分类更糟 ——
 *    用户会觉得「收藏功能坏了」，而实际上只是分类名重复了。
 * 3. **逐条跳过已收藏**。重复写入同一条路径会让收藏列表出现重复项。
 */
export function resolveFavoriteCategorySelection(
  entries: DirEntry[],
  selectedCategoryId: string | null,
  newCategoryName: string | null,
  deps: FavoriteCategorySelectionDeps,
): FavoriteCategorySelectionResult {
  const trimmedName = newCategoryName?.trim() ?? '';
  let categoryId = selectedCategoryId;
  let createdCategory = false;

  if (trimmedName) {
    const created = deps.createFavoriteCategory(trimmedName);

    if (created) {
      categoryId = created.id;
      createdCategory = true;
    }
    else {
      // 重名 / 非法名：保留用户在下拉里的选择，没有选择就是未分类。
      categoryId = selectedCategoryId;
    }
  }

  let addedCount = 0;

  for (const entry of entries) {
    if (deps.isFavorite(entry.path)) {
      continue;
    }

    deps.addToFavorites(entry.path, !entry.is_dir, categoryId);
    addedCount += 1;
  }

  return {
    categoryId,
    createdCategory,
    addedCount,
  };
}
