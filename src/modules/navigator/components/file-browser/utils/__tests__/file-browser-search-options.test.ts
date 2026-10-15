// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 需求反馈 2（2026-10-16）——目录内搜索与全局搜索的选项统一。
//
// 这一组断言的价值在于「不平凡」：每一对断言里都有一条是为了让某个具体缺陷变红，
// 而不是把当前实现的输出抄一遍。抄实现的测试在重构时不会响，只会在改错时也不响。

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import type { DirSizesStore } from '../file-browser-sort';
import { createFileBrowserQuickSearchMatcher } from '../file-browser-entry-quick-search';
import {
  FILE_BROWSER_SEARCH_RESULT_LIMIT_DEFAULT,
  clampFileBrowserSearchResultLimit,
  fileBrowserEntryMatchesExactSearch,
  isEntryAllowedBySearchKind,
  limitFileBrowserSearchResults,
} from '../file-browser-search-options';

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {
      dateTime: {
        month: 'short',
        regionalFormat: {
          code: 'en-US',
          name: 'United States',
        },
        autoDetectRegionalFormat: false,
        hour12: true,
        showRelativeDates: false,
        properties: {
          showSeconds: false,
          showMilliseconds: false,
        },
      },
    },
  }),
}));

const MB = 1024 ** 2;

function createEntry(overrides: Partial<DirEntry> = {}): DirEntry {
  return {
    name: 'readme.txt',
    ext: 'txt',
    path: 'C:/docs/readme.txt',
    size: 0,
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

// 强转成 unknown 是为了绕开 Pinia store 的类型：这里只需要 getSize 一个方法，
// 而 DirSizesStore 带着 $state / $patch / $subscribe 等一堆 store 成员。
function createDirSizesStore(): DirSizesStore {
  return {
    sizes: new Map(),
    getSize: () => undefined,
  } as unknown as DirSizesStore;
}

describe('clampFileBrowserSearchResultLimit', () => {
  it('把区间内的值原样返回', () => {
    expect(clampFileBrowserSearchResultLimit(120)).toBe(120);
  });

  it('把超上界的手输值夹回上界', () => {
    // 这条守的是「删掉一个 0」的手滑：9999 会让递归通道真的去捞 9999 条。
    expect(clampFileBrowserSearchResultLimit(9999)).toBe(500);
  });

  it('把低于下界的值夹回下界', () => {
    expect(clampFileBrowserSearchResultLimit(1)).toBe(10);
    expect(clampFileBrowserSearchResultLimit(0)).toBe(10);
    expect(clampFileBrowserSearchResultLimit(-30)).toBe(10);
  });

  it('对非数字回落到默认值，而不是 NaN', () => {
    expect(clampFileBrowserSearchResultLimit(undefined)).toBe(FILE_BROWSER_SEARCH_RESULT_LIMIT_DEFAULT);
    expect(clampFileBrowserSearchResultLimit('abc')).toBe(FILE_BROWSER_SEARCH_RESULT_LIMIT_DEFAULT);
    expect(clampFileBrowserSearchResultLimit(Number.NaN)).toBe(FILE_BROWSER_SEARCH_RESULT_LIMIT_DEFAULT);
    expect(clampFileBrowserSearchResultLimit(Number.POSITIVE_INFINITY))
      .toBe(FILE_BROWSER_SEARCH_RESULT_LIMIT_DEFAULT);
  });

  it('对字符串数字先取整再夹取', () => {
    expect(clampFileBrowserSearchResultLimit('80')).toBe(80);
    expect(clampFileBrowserSearchResultLimit('80.9')).toBe(80);
  });
});

describe('isEntryAllowedBySearchKind', () => {
  const file = createEntry({
    name: 'a.txt',
    is_dir: false,
    is_file: true,
  });
  const dir = createEntry({
    name: 'sub',
    ext: null,
    path: 'C:/docs/sub',
    is_dir: true,
    is_file: false,
  });

  it('两个开关都开时两类都放行', () => {
    expect(isEntryAllowedBySearchKind(file, {
      includeFiles: true,
      includeDirectories: true,
    })).toBe(true);
    expect(isEntryAllowedBySearchKind(dir, {
      includeFiles: true,
      includeDirectories: true,
    })).toBe(true);
  });

  it('只开文件时目录被挡掉', () => {
    expect(isEntryAllowedBySearchKind(file, {
      includeFiles: true,
      includeDirectories: false,
    })).toBe(true);
    expect(isEntryAllowedBySearchKind(dir, {
      includeFiles: true,
      includeDirectories: false,
    })).toBe(false);
  });

  it('只开目录时文件被挡掉', () => {
    expect(isEntryAllowedBySearchKind(file, {
      includeFiles: false,
      includeDirectories: true,
    })).toBe(false);
    expect(isEntryAllowedBySearchKind(dir, {
      includeFiles: false,
      includeDirectories: true,
    })).toBe(true);
  });

  it('两个都关时放行全部，不把结果清成空列表', () => {
    // 「无效配置按无害处理」。写成 false 的话，用户会看到一个 0 项的结果列表，
    // 且界面上没有任何线索说明是自己把结果全关了。
    expect(isEntryAllowedBySearchKind(file, {
      includeFiles: false,
      includeDirectories: false,
    })).toBe(true);
    expect(isEntryAllowedBySearchKind(dir, {
      includeFiles: false,
      includeDirectories: false,
    })).toBe(true);
  });
});

describe('fileBrowserEntryMatchesExactSearch', () => {
  it('名字全等命中，大小写不敏感', () => {
    expect(fileBrowserEntryMatchesExactSearch(createEntry({
      name: 'Report',
      ext: 'pdf',
    }), 'report')).toBe(true);
  });

  it('子串不命中 —— 这正是与默认模式的核心差别', () => {
    // 对照：同样的输入在默认（子串）模式下会命中。
    expect(fileBrowserEntryMatchesExactSearch(createEntry({ name: 'readme.txt' }), 'read')).toBe(false);
    expect(fileBrowserEntryMatchesExactSearch(createEntry({ name: 'readme.txt' }), 'me.t')).toBe(false);
  });

  it('扩展名全等命中', () => {
    expect(fileBrowserEntryMatchesExactSearch(createEntry({
      name: 'readme.txt',
      ext: 'txt',
    }), 'txt')).toBe(true);
    expect(fileBrowserEntryMatchesExactSearch(createEntry({
      name: 'readme.TXT',
      ext: 'TXT',
    }), 'txt')).toBe(true);
    expect(fileBrowserEntryMatchesExactSearch(createEntry({
      name: 'readme.txt',
      ext: 'txt',
    }), 'md')).toBe(false);
  });

  it('带点的扩展名全等命中，与关闭精确匹配时方向一致', () => {
    const png = createEntry({
      name: 'shot.png',
      ext: 'png',
    });
    expect(fileBrowserEntryMatchesExactSearch(png, '.png')).toBe(true);
    expect(fileBrowserEntryMatchesExactSearch(png, '.jpg')).toBe(false);
  });
});

describe('createFileBrowserQuickSearchMatcher 的精确匹配开关', () => {
  const dirSizesStore = createDirSizesStore();

  it('关闭时沿用子串语义（默认行为不被改坏）', () => {
    const matcher = createFileBrowserQuickSearchMatcher('read', dirSizesStore);
    expect(matcher(createEntry({ name: 'readme.txt' }))).toBe(true);
  });

  it('开启时裸词走全等', () => {
    const matcher = createFileBrowserQuickSearchMatcher('read', dirSizesStore, undefined, { exactMatch: true });
    expect(matcher(createEntry({ name: 'readme.txt' }))).toBe(false);
    expect(matcher(createEntry({
      name: 'read',
      ext: null,
      path: 'C:/docs/read',
    }))).toBe(true);
  });

  it('开启时带结构化谓词的查询不受影响', () => {
    // size:>1MB 这类查询带着自己的比较语义，再叠一层全等就没法表达了。
    const matcher = createFileBrowserQuickSearchMatcher('size:>1mb', dirSizesStore, undefined, { exactMatch: true });
    expect(matcher(createEntry({
      name: 'big.bin',
      ext: 'bin',
      size: 2 * MB,
    }))).toBe(true);
    expect(matcher(createEntry({
      name: 'small.bin',
      ext: 'bin',
      size: 1,
    }))).toBe(false);
  });

  it('开启时空查询仍然放行全部', () => {
    const matcher = createFileBrowserQuickSearchMatcher('   ', dirSizesStore, undefined, { exactMatch: true });
    expect(matcher(createEntry({ name: 'anything.bin' }))).toBe(true);
  });
});

describe('limitFileBrowserSearchResults', () => {
  // 下界是 10，所以这里用 12 / 50 这类值；传 3 会被夹到 10，对 5 个元素不构成截断。
  const items = Array.from({ length: 12 }, (_, index) => index + 1);

  it('超过上限时按原顺序截断', () => {
    expect(limitFileBrowserSearchResults(items, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('不足上限时原样返回同一个引用', () => {
    expect(limitFileBrowserSearchResults(items, 50)).toBe(items);
  });

  it('不修改入参数组', () => {
    const before = [...items];
    limitFileBrowserSearchResults(items, 10);
    expect(items).toEqual(before);
  });

  it('越界上限先被夹取再截断', () => {
    // 99999 被夹到 500，12 个元素不够 500，于是全保留 —— 不是被 99999 放行。
    expect(limitFileBrowserSearchResults(items, 99999)).toBe(items);
    // 反过来，低于下界的值夹到 10，仍然会截断。
    expect(limitFileBrowserSearchResults(items, 3)).toHaveLength(10);
  });
});
