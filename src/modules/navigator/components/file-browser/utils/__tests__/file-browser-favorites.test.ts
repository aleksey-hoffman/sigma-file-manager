// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 用户反馈（2026-10-16）——右键「添加到收藏」增加分类选择步骤。
//
// 这组测试守的是两条**静默降级**路径。它们的共同特点是：不报错、不提示、
// 结果看着「大概对」，只有断言落盘内容才能发现 —— 也就是 AGENTS.md 里那条
// 「只断言内存状态的测试抓不到落盘缺陷」的同类风险，只是这次发生在决策层。

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  resolveFavoriteCategorySelection,
  shouldOpenFavoriteCategoryDialog,
  type FavoriteCategorySelectionDeps,
} from '../file-browser-favorites';

function createEntry(overrides: Partial<DirEntry> = {}): DirEntry {
  return {
    name: 'report.pdf',
    ext: 'pdf',
    path: 'C:/docs/report.pdf',
    size: 10,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
    ...overrides,
  };
}

function createDeps(options: {
  favoritePaths?: string[];
  createdCategory?: {
    id: string;
    name: string;
  } | null;
} = {}) {
  const favorites = new Set(options.favoritePaths ?? []);

  const deps: FavoriteCategorySelectionDeps = {
    isFavorite: path => favorites.has(path),
    createFavoriteCategory: vi.fn(() => options.createdCategory ?? null),
    addToFavorites: vi.fn((path: string, isFile: boolean, categoryId: string | null) => {
      expect(typeof isFile).toBe('boolean');
      // 未分类必须是显式的 null，写成 undefined 会让 store 那边存下一个 undefined 键。
      expect(categoryId === null || typeof categoryId === 'string').toBe(true);
      favorites.add(path);
    }),
  };

  return {
    deps,
    favorites,
  };
}

describe('shouldOpenFavoriteCategoryDialog', () => {
  it('一个都没收藏过时要弹分类对话框', () => {
    const entries = [createEntry(), createEntry({
      path: 'C:/docs/a.txt',
      name: 'a.txt',
    })];
    expect(shouldOpenFavoriteCategoryDialog(entries, () => false)).toBe(true);
  });

  it('全部已收藏时不弹，直接走取消收藏', () => {
    const entries = [createEntry({ path: 'C:/x' }), createEntry({ path: 'C:/y' })];
    expect(shouldOpenFavoriteCategoryDialog(entries, path => path === 'C:/x' || path === 'C:/y')).toBe(false);
  });

  it('一部分已收藏时仍然要弹', () => {
    // 对照：只看「第一个是不是已收藏」的错误写法在这种情况下会漏弹，
    // 用户的直觉是「这些条目里有的还没收藏，点了就该能补上」。
    const entries = [createEntry({ path: 'C:/x' }), createEntry({ path: 'C:/y' })];
    expect(shouldOpenFavoriteCategoryDialog(entries, path => path === 'C:/x')).toBe(true);
  });

  it('空选择不弹（取消分支是空操作）', () => {
    expect(shouldOpenFavoriteCategoryDialog([], () => false)).toBe(false);
  });
});

describe('resolveFavoriteCategorySelection', () => {
  it('填了新分类名时用新分类，而不是下拉里选中的那个', () => {
    const { deps } = createDeps({
      createdCategory: {
        id: 'cat-new',
        name: '工作',
      },
    });

    const result = resolveFavoriteCategorySelection(
      [createEntry()],
      'cat-old',
      '工作',
      deps,
    );

    expect(deps.createFavoriteCategory).toHaveBeenCalledWith('工作');
    expect(deps.addToFavorites).toHaveBeenCalledWith('C:/docs/report.pdf', true, 'cat-new');
    expect(result).toEqual({
      categoryId: 'cat-new',
      createdCategory: true,
      addedCount: 1,
    });
  });

  it('新分类名会去掉首尾空白再建', () => {
    const { deps } = createDeps({
      createdCategory: {
        id: 'cat-new',
        name: '工作',
      },
    });
    resolveFavoriteCategorySelection([createEntry()], null, '  工作  ', deps);
    expect(deps.createFavoriteCategory).toHaveBeenCalledWith('工作');
  });

  it('重名导致新建失败时落到下拉选择，不中断写入', () => {
    const { deps } = createDeps({ createdCategory: null });

    const result = resolveFavoriteCategorySelection([createEntry()], 'cat-old', '工作', deps);

    // 这是本次改动里最容易被写坏的一条：写成 throw 或 early return，
    // 用户点了收藏却什么都没发生，且界面不报错。
    expect(deps.addToFavorites).toHaveBeenCalledWith('C:/docs/report.pdf', true, 'cat-old');
    expect(result.createdCategory).toBe(false);
    expect(result.addedCount).toBe(1);
  });

  it('重名且没在下拉里选时落到未分类（null），而不是空字符串或 undefined', () => {
    const { deps } = createDeps({ createdCategory: null });

    const result = resolveFavoriteCategorySelection([createEntry()], null, '工作', deps);

    expect(deps.addToFavorites).toHaveBeenCalledWith('C:/docs/report.pdf', true, null);
    expect(result.categoryId).toBeNull();
  });

  it('没填新分类名时直接用下拉选择，且不调用新建', () => {
    const { deps } = createDeps();
    resolveFavoriteCategorySelection([createEntry()], 'cat-old', null, deps);
    expect(deps.createFavoriteCategory).not.toHaveBeenCalled();
    expect(deps.addToFavorites).toHaveBeenCalledWith('C:/docs/report.pdf', true, 'cat-old');
  });

  it('只填空白时视为没填，不调用新建', () => {
    const { deps } = createDeps({
      createdCategory: {
        id: 'x',
        name: 'x',
      },
    });
    resolveFavoriteCategorySelection([createEntry()], 'cat-old', '   ', deps);
    expect(deps.createFavoriteCategory).not.toHaveBeenCalled();
  });

  it('跳过已收藏的条目，不重复写', () => {
    const { deps } = createDeps({ favoritePaths: ['C:/docs/report.pdf'] });

    const result = resolveFavoriteCategorySelection([createEntry()], 'cat-old', null, deps);

    expect(deps.addToFavorites).not.toHaveBeenCalled();
    expect(result.addedCount).toBe(0);
  });

  it('目录条目按 is_file=false 写入', () => {
    const { deps } = createDeps();
    const dir = createEntry({
      name: 'sub',
      ext: null,
      path: 'C:/docs/sub',
      is_dir: true,
      is_file: false,
    });
    resolveFavoriteCategorySelection([dir], null, null, deps);
    expect(deps.addToFavorites).toHaveBeenCalledWith('C:/docs/sub', false, null);
  });

  it('多选时逐条写入同一个分类', () => {
    const { deps } = createDeps();
    const entries = [
      createEntry({ path: 'C:/a' }),
      createEntry({ path: 'C:/b' }),
      createEntry({ path: 'C:/c' }),
    ];

    const result = resolveFavoriteCategorySelection(entries, 'cat-old', null, deps);

    expect(deps.addToFavorites).toHaveBeenCalledTimes(3);
    expect(result.addedCount).toBe(3);

    for (const call of vi.mocked(deps.addToFavorites).mock.calls) {
      expect(call[2]).toBe('cat-old');
    }
  });

  it('空选择是空操作', () => {
    const { deps } = createDeps();
    const result = resolveFavoriteCategorySelection([], null, null, deps);
    expect(deps.addToFavorites).not.toHaveBeenCalled();
    expect(result.addedCount).toBe(0);
  });
});
