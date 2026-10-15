// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 需求反馈 2（2026-10-16）——目录内搜索与全局搜索的选项统一。
//
// 读侧（searchOptions）和写侧（三个 setter）放在一起，是刻意的：全局搜索那边
// 也有同名 setter，两边如果各写一遍，夹取规则（10..500）就会漂。放一起之后，
// 「目录内搜索的结果条数上限」和「全局搜索的结果条数上限」在字面上就是同一个函数。

import { computed, type ComputedRef } from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { clampFileBrowserSearchResultLimit } from '@/modules/navigator/components/file-browser/utils/file-browser-search-options';

export interface FileBrowserSearchOptions {
  includeFiles: boolean;
  includeDirectories: boolean;
  exactMatch: boolean;
  resultLimit: number;
}

export function useFileBrowserSearchOptions(): {
  searchOptions: ComputedRef<FileBrowserSearchOptions>;
  setIncludeFiles: (value: boolean | 'indeterminate') => void;
  setIncludeDirectories: (value: boolean | 'indeterminate') => void;
  setExactMatch: (value: boolean | 'indeterminate') => void;
  setResultLimit: (value: string | number | undefined) => void;
} {
  const userSettingsStore = useUserSettingsStore();

  const searchOptions = computed<FileBrowserSearchOptions>(() => {
    const settings = userSettingsStore.userSettings.globalSearch;

    return {
      includeFiles: settings.includeFiles,
      includeDirectories: settings.includeDirectories,
      exactMatch: settings.exactMatch,
      // 取值口就夹一次：下游（递归通道的 limit、结果截断）可以直接信任这个数字。
      resultLimit: clampFileBrowserSearchResultLimit(settings.resultLimit),
    };
  });

  // 三元组的写入统一吃 boolean | 'indeterminate'：Checkbox 组件传的就是这个类型，
  // 'indeterminate' 时不写（等于「用户没真的做选择」），避免把界面上的半选状态
  // 写进设置变成一个假值。
  function setIncludeFiles(value: boolean | 'indeterminate') {
    if (typeof value === 'boolean') {
      userSettingsStore.set('globalSearch.includeFiles', value);
    }
  }

  function setIncludeDirectories(value: boolean | 'indeterminate') {
    if (typeof value === 'boolean') {
      userSettingsStore.set('globalSearch.includeDirectories', value);
    }
  }

  function setExactMatch(value: boolean | 'indeterminate') {
    if (typeof value === 'boolean') {
      userSettingsStore.set('globalSearch.exactMatch', value);
    }
  }

  function setResultLimit(value: string | number | undefined) {
    userSettingsStore.set('globalSearch.resultLimit', clampFileBrowserSearchResultLimit(value));
  }

  return {
    searchOptions,
    setIncludeFiles,
    setIncludeDirectories,
    setExactMatch,
    setResultLimit,
  };
}
