// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 需求反馈 2（2026-10-16）——搜索选项的读写两侧。
//
// 这个测试守的是「面板上的勾和列表里的结果对不上」这类缺陷。
// 只测纯函数不够：纯函数是对的，但接线接错了（比如写到了另一个键上），
// 界面表现完全一样 —— 选项勾着，列表不变。

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { useFileBrowserSearchOptions } from '../use-file-browser-search-options';

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  globalSearch: {
    includeFiles: true,
    includeDirectories: true,
    exactMatch: false,
    resultLimit: 50,
  },
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: { globalSearch: mocks.globalSearch },
    set: mocks.set,
  }),
}));

describe('useFileBrowserSearchOptions', () => {
  beforeEach(() => {
    mocks.set.mockClear();
    mocks.globalSearch.includeFiles = true;
    mocks.globalSearch.includeDirectories = true;
    mocks.globalSearch.exactMatch = false;
    mocks.globalSearch.resultLimit = 50;
  });

  it('读侧把 userSettings.globalSearch 的四个键原样取出', () => {
    mocks.globalSearch.includeFiles = false;
    mocks.globalSearch.exactMatch = true;
    mocks.globalSearch.resultLimit = 120;

    const { searchOptions } = useFileBrowserSearchOptions();

    expect(searchOptions.value).toEqual({
      includeFiles: false,
      includeDirectories: true,
      exactMatch: true,
      resultLimit: 120,
    });
  });

  it('读侧对越界的 resultLimit 夹取后再交给下游', () => {
    // 这条守的是递归通道：它直接信任这个数字去发起磁盘遍历。
    mocks.globalSearch.resultLimit = 99999;
    expect(useFileBrowserSearchOptions().searchOptions.value.resultLimit).toBe(500);

    mocks.globalSearch.resultLimit = 0;
    expect(useFileBrowserSearchOptions().searchOptions.value.resultLimit).toBe(10);
  });

  it('写侧落到 globalSearch 下的同名键，而不是新开一份', () => {
    const { setIncludeFiles, setIncludeDirectories, setExactMatch } = useFileBrowserSearchOptions();

    setIncludeFiles(false);
    setIncludeDirectories(false);
    setExactMatch(true);

    expect(mocks.set.mock.calls).toEqual([
      ['globalSearch.includeFiles', false],
      ['globalSearch.includeDirectories', false],
      ['globalSearch.exactMatch', true],
    ]);
  });

  it('indeterminate 不写入', () => {
    const { setIncludeFiles, setIncludeDirectories, setExactMatch } = useFileBrowserSearchOptions();

    setIncludeFiles('indeterminate');
    setIncludeDirectories('indeterminate');
    setExactMatch('indeterminate');

    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('写 resultLimit 时先夹取再写', () => {
    const { setResultLimit } = useFileBrowserSearchOptions();

    setResultLimit(99999);
    expect(mocks.set).toHaveBeenLastCalledWith('globalSearch.resultLimit', 500);

    setResultLimit('30');
    expect(mocks.set).toHaveBeenLastCalledWith('globalSearch.resultLimit', 30);

    setResultLimit(undefined);
    expect(mocks.set).toHaveBeenLastCalledWith('globalSearch.resultLimit', 50);
  });
});
