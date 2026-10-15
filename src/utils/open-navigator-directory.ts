// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Router } from 'vue-router';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import { loadNavigatorRoute } from '@/router/routes';
import {
  resolvePathLaunchTarget,
  type LaunchTarget,
} from '@/utils/launch-directories';
import normalizePath, { getParentDirectory } from '@/utils/normalize-path';
import { resolveNavigableItemTarget } from '@/utils/resolve-navigable-item-target';

export function preloadNavigatorRoute(): void {
  void loadNavigatorRoute();
}

export interface OpenNavigatorPathOptions {
  resolvePath?: boolean;
}

function logNavigatorOpenError(error: unknown): void {
  console.error('Failed to open navigator path:', error);
}

function runNavigatorOpenTask(task: () => Promise<void>): void {
  void task().catch(logNavigatorOpenError);
}

function isNavigatorRoute(router: Router): boolean {
  return router.currentRoute.value.name === 'navigator';
}

function ensureNavigatorRoute(router: Router): void {
  if (!isNavigatorRoute(router)) {
    void router.push({ name: 'navigator' });
  }
}

function createOptimisticLaunchTarget(path: string): LaunchTarget {
  return {
    directoryPath: path,
    focusPath: null,
  };
}

function needsLaunchTargetCorrection(
  optimistic: LaunchTarget,
  resolved: LaunchTarget,
): boolean {
  return normalizePath(optimistic.directoryPath) !== normalizePath(resolved.directoryPath)
    || (optimistic.focusPath ?? null) !== (resolved.focusPath ?? null);
}

async function resolveNavigatorLaunchTarget(rawPath: string): Promise<LaunchTarget | null> {
  const workspacesStore = useWorkspacesStore();

  return resolvePathLaunchTarget(
    rawPath,
    path => workspacesStore.getDirEntry({ path }),
  );
}

async function applyLaunchTarget(
  router: Router,
  launchTarget: LaunchTarget,
  openedNewTabGroup: { value: boolean },
): Promise<void> {
  const workspacesStore = useWorkspacesStore();

  if (isNavigatorRoute(router) || openedNewTabGroup.value) {
    await workspacesStore.openPathInCurrentTab(launchTarget.directoryPath);
  }
  else {
    await workspacesStore.openNewTabGroup(launchTarget.directoryPath);
    openedNewTabGroup.value = true;
  }

  if (launchTarget.focusPath) {
    workspacesStore.setPendingLaunchReveal(
      launchTarget.directoryPath,
      launchTarget.focusPath,
    );
  }
}

export function openNavigatorPathInNewTab(router: Router, path: string): void {
  ensureNavigatorRoute(router);

  runNavigatorOpenTask(async () => {
    await useWorkspacesStore().openNewTabGroup(path);
  });
}

export function openNavigatorPath(
  router: Router,
  path: string,
  options?: OpenNavigatorPathOptions,
): void {
  ensureNavigatorRoute(router);

  if (options?.resolvePath) {
    const optimisticTarget = createOptimisticLaunchTarget(path);

    runNavigatorOpenTask(async () => {
      const openedNewTabGroup = { value: false };

      await applyLaunchTarget(router, optimisticTarget, openedNewTabGroup);

      const resolvedTarget = await resolveNavigatorLaunchTarget(path);

      if (resolvedTarget && needsLaunchTargetCorrection(optimisticTarget, resolvedTarget)) {
        await applyLaunchTarget(router, resolvedTarget, openedNewTabGroup);
      }
    });

    return;
  }

  runNavigatorOpenTask(async () => {
    const openedNewTabGroup = { value: false };
    await applyLaunchTarget(router, createOptimisticLaunchTarget(path), openedNewTabGroup);
  });
}

// FORK-MODIFICATION: 搜索结果「打开所属目录」——把条目的父目录显示在**结果列表旁边**的
// 导航器 pane 上，并选中该条目；结果列表本身保持打开、内容不变。
//
// 为什么不用 `openNavigatorPath(..., { resolvePath: true })`：那条路径靠
// `resolvePathLaunchTarget` 判断条目类型，目录会解析成「进入该目录」且 focusPath 为空。
// 本动作的语义恰恰相反——目录的父目录才是目标，且目录本身要被选中。
// 所以这里直接构造参数，两种条目类型走同一条逻辑。
//
// ── 用户要的是这个布局 ────────────────────────────────────────────────
//   ┌──────────────────┬──────────────────┐
//   │  搜索结果列表      │  所属目录导航器    │
//   │（保持打开、内容不变）│ （选中该条目）      │
//   └──────────────────┴──────────────────┘
// 而「先关搜索面板 + 拆分导航器」得到的是
//   ┌──────────────────┬──────────────────┐
//   │  导航器原位置      │  导航器所属目录    │
//   └──────────────────┴──────────────────┘
//   （搜索面板已关闭）—— 2026-10-15 用户明确指出这是错的。
//
// 关键事实：**用户要的布局已经存在，不需要造。**
// `navigator.vue` 的 `.navigator-page__panes-container` 是 `display: flex`
// （未声明 `flex-direction`，即默认 row），全局搜索面板是它的第一个子元素、
// 导航器 pane 组是第二个，搜索一打开天然就是左右并排。
// 所以本函数的正确工作是「别破坏它」，而不是新开标签组或新开 pane。
//
// 两条曾经的错路，别再走：
//
// 1. **不要关搜索面板**。调用点原先先 `globalSearchStore.close()`，理由写的是
//    「否则导航结果被面板挡住」——那是被拆分实现带出来的新问题，不是原有问题。
//    关掉之后左侧列表整个消失，布局退化成「导航器 + 导航器」。
//
// 2. **搜索面板开着时不要拆分**。`navigator.vue` 有一条 watch：搜索打开时若已拆分
//    就 `toggleSplitView()` 合上（产品上「搜索 + 拆分」互斥）。反过来说，
//    搜索开着时再拆分，是让左侧搜索面板和右侧两个导航器 pane 挤在一屏里，
//    用户原位置的上下文也搬到了第二格。此时旁边的导航器 pane 直接复用即可。
//
// 什么时候仍然需要拆分：`isSearchResultsView` 有两条通道
// （`use-file-browser.ts:581`）——全局搜索面板（`externalEntries`）与工具栏目录过滤。
// 后者没有独立面板，**结果列表就是导航器 pane 自己**，要同时满足「列表不变」和
// 「显示父目录」只能新开一个 pane。已拆分则复用最右那个（`WORKSPACE_MAX_PANE_COUNT`
// 是 2，不存在第三个 pane）。
//
// 重复点别的搜索结果时**复用同一个 pane**（`openPathInCurrentTab` 改路径），
// 而不是每次新建 —— 否则点几次就多几格，面板会被撑爆。
export function openNavigatorRevealEntry(router: Router, entryPath: string): void {
  ensureNavigatorRoute(router);

  const parentPath = getParentDirectory(entryPath);
  const workspacesStore = useWorkspacesStore();
  const globalSearchStore = useGlobalSearchStore();

  runNavigatorOpenTask(async () => {
    const paneCount = workspacesStore.currentTabGroup?.length ?? 0;
    const isResultsPanelDedicated = globalSearchStore.isOpen;

    // 结果列表独立在搜索面板里 → 旁边的导航器 pane 复用（最右那个）；
    // 否则它就是结果列表本身，必须拆出新 pane 才能既保留列表又显示父目录。
    // paneCount === 0 时不拆：`toggleSplitView` 会去 clone tabGroup[0]，空组上会炸。
    let targetPaneIndex = Math.max(0, paneCount - 1);

    if (!isResultsPanelDedicated && paneCount === 1) {
      workspacesStore.toggleSplitView();
      // enableSplitView 是 push 一个 tabGroup[0] 的克隆，新 pane 落在最右 = index 1。
      targetPaneIndex = 1;
    }

    workspacesStore.setCurrentTabIndex(targetPaneIndex);
    await workspacesStore.openPathInCurrentTab(parentPath);
    workspacesStore.setPendingLaunchReveal(parentPath, normalizePath(entryPath));
  });
}

export function openNavigatorNavigablePath(
  router: Router,
  path: string,
  isFile: boolean,
): void {
  ensureNavigatorRoute(router);

  runNavigatorOpenTask(async () => {
    const navigableItemTarget = await resolveNavigableItemTarget(path, isFile);
    const directoryPath = navigableItemTarget.opensAsFile
      ? getParentDirectory(navigableItemTarget.targetPath)
      : navigableItemTarget.targetPath;

    const openedNewTabGroup = { value: false };
    await applyLaunchTarget(
      router,
      createOptimisticLaunchTarget(directoryPath),
      openedNewTabGroup,
    );
  });
}
