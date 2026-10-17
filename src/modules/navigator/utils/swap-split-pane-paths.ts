// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Tab, TabGroup } from '@/types/workspaces';
import { getPathDisplayName } from '@/utils/normalize-path';

/**
 * FORK-MODIFICATION: 交换分屏两格显示的路径。
 *
 * 抽成纯函数而不是把逻辑写在 store 里，是因为 store 依赖模块私有的
 * `updateTabPath` 与 `currentTabGroup`，在单测里驱动真实 store 要拖进来一整条
 * 依赖链；而这段逻辑的真正不变量（交换、越界、同一目录、不污染别的格子）
 * 全部可以在这里直接断言。store 只是调用方。
 *
 * 就地修改传入的 TabGroup 并返回是否真的换了 —— 返回 false 有两种含义，
 * 调用方可以据此决定要不要提示用户。
 */
export function swapTabGroupPaths(tabGroup: TabGroup | null | undefined): boolean {
  if (!tabGroup || tabGroup.length < 2) {
    return false;
  }

  const leftTab = tabGroup[0];
  const rightTab = tabGroup[1];

  // 两格指向同一个目录时不做任何事：那不是「没有可交换的东西」，
  // 而是一次没有结果的操作。留着不动比换完再换回来更不容易让人困惑。
  if (leftTab.path === rightTab.path) {
    return false;
  }

  // 两个路径必须**先**取出来再写。
  // 直接 `applyPathToTab(leftTab, rightTab.path)` 然后 `applyPathToTab(rightTab, leftTab.path)`
  // 会踩典型的别名坑：第一行已经把 leftTab.path 改成了 rightTab.path，
  // 第二行读到的就是改过之后的值 —— 结果两格都指向右边那个目录。
  const leftPath = leftTab.path;
  const rightPath = rightTab.path;

  applyPathToTab(leftTab, rightPath);
  applyPathToTab(rightTab, leftPath);

  return true;
}

/**
 * 换目录时要一起清掉的每格临时态。
 *
 * 与 `openPathInCurrentTab` 保持一致：换了目录还留着上一处的条目、
 * 选中项和过滤词，会在面板里闪一下旧内容；而「B 盘搜出来的结果」配着
 * 「A 盘的文件列表」更让人以为自己操作错了。
 */
function applyPathToTab(tab: Tab, path: string) {
  tab.path = path;
  tab.name = getPathDisplayName(path) || path;
  tab.dirEntries = [];
  tab.selectedDirEntries = [];
  tab.filterQuery = '';
}
