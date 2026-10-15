// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';

export type Workspace = {
  id: number;
  isPrimary: boolean;
  isCurrent: boolean;
  name: string;
  actions: TabAction[];
  tabGroups: TabGroup[];
  currentTabGroupIndex: number;
  currentTabIndex: number;
};

export type Tab = {
  id: string;
  name: string;
  path: string;
  type: 'directory' | 'file' | 'search';
  paneWidth: number;
  filterQuery: string;
  dirEntries: DirEntry[];
  selectedDirEntries: DirEntry[];
  /**
   * FORK-MODIFICATION: 反馈 3（2026-10-15）——**仅运行期**的过滤词交接位。
   *
   * 为什么需要它：过滤框的内容（`use-file-browser-filter` 里的 `filterQuery` ref）
   * 是组件本地状态，而分栏的每个 pane 是各自独立的 FileBrowser 实例。
   * 「打开所属目录」拆分出新 pane 后，右格那个实例挂载时过滤词是空的，
   * 于是搜索结果整格消失 —— 右格剩下的只是搜索前的目录。
   *
   * 为什么不用现成的 `filterQuery` 字段：那个字段在 schema 和持久化里都有，
   * 但从来没人写它（`setTabFilterQuery` 是死代码），而且它是**要落盘**的。
   * 接上它等于把「过滤词跨重启保留」也一起改了，那是另一件事。
   * 持久化是 `persistedWorkspaces` 逐字段挑选的，本字段不在名单里，
   * 所以它只活在内存里，重启即失效 —— 这正是这里想要的语义。
   */
  pendingFilterQuery?: string;
  /**
   * FORK-MODIFICATION: 反馈 3（2026-10-15）——**仅运行期**的「强制列表样式」标记。
   *
   * 「打开所属目录」分栏后左右两格都要列表样式（用户原话：「注意都采用列表样式视图」）。
   * 为什么标记挂在 tab 上、由 FileBrowser 自己解析，而不是外层覆盖 `layout` prop：
   * 那样需要 navigator.vue 多存一份锁状态、多一个 watch、还要给每个 pane 加
   * `@layout-change` 监听才能在用户点布局按钮时解锁。挂在 tab 上则这四样全都不存在 ——
   * 解锁的两个时机（用户点布局按钮、pane 导航去别处）都在 FileBrowser 自己身上。
   *
   * 为什么不改 folder settings：layout 是用户自己记住的 per-folder 设置，
   * 替他写等于偷偷改掉用户的选择，他下次点网格会困惑。
   *
   * 与 `pendingFilterQuery` 一样不在 `persistedWorkspaces` 的字段名单里，只活在内存。
   */
  pendingForceListLayout?: boolean;
};

export type TabGroup = Tab[];

export type TabAction = {
  name: string;
  path: string;
};
