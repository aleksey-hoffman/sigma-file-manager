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

/**
 * FORK-MODIFICATION: 反馈 3（2026-10-15）。
 * `filterQuery` 是触发动作那个 pane 当前的过滤词 —— 拆出来的右格要靠它
 * 继续显示同一批搜索结果。调用方（use-file-browser-actions）拿得到，
 * 这里收下；全局搜索面板通道用不到，可以不传。
 */
export interface OpenNavigatorRevealEntryOptions {
  filterQuery?: string;
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

// FORK-MODIFICATION: 搜索结果「打开所属目录」——把条目的父目录显示在**结果列表
// 所在那一格的反面**：所属目录落在左格，搜索结果留在右格，并选中该条目。
//
// 为什么不用 `openNavigatorPath(..., { resolvePath: true })`：那条路径靠
// `resolvePathLaunchTarget` 判断条目类型，目录会解析成「进入该目录」且 focusPath 为空。
// 本动作的语义恰恰相反——目录的父目录才是目标，且目录本身要被选中。
// 所以这里直接构造参数，两种条目类型走同一条逻辑。
//
// ── 两条搜索通道，目标布局不一样 ────────────────────────────────────────
//   工具栏过滤（结果列表就是导航器 pane 自己，需要拆栏）：
//     ┌──────────────┬──────────────┐
//     │  所属目录      │  搜索结果      │
//     │（选中该条目）  │（过滤词保留）  │
//     └──────────────┴──────────────┘
//   全局搜索面板（结果列表独立在面板里，布局本来就是左右并排）：
//     ┌──────────────┬──────────────┐
//     │  搜索结果面板  │  所属目录导航器 │
//     └──────────────┴──────────────┘
//   两条通道由 `globalSearchStore.isOpen` 区分。
//   2026-10-15 反馈 3：工具栏过滤通道原来是「左 = 搜索前的目录、右 = 所属目录」，
//   与用户要的左右正好反过来；全局搜索面板这一路是上一批反馈 2 定的，方向不动。
//
// 工具栏过滤通道要拿到「右格继续显示搜索结果」，光调 `toggleSplitView` 不够：
// 新 pane 是全新挂载的 FileBrowser 实例，过滤词在组件本地 ref 里，克隆拿不到。
// 所以拆分后要把过滤词显式挂到右格那个 tab 上（`pendingFilterQuery`），
// 由 FileBrowser 挂载时取走。详见 types/workspaces.ts 的字段注释。
//
// 什么时候仍然需要拆分：只有工具栏过滤这一条通道 —— 全局搜索面板不拆，
// `navigator.vue` 有一条 watch 规定「搜索打开时若已拆分就合上」（产品上二者互斥）。
//
// 重复点别的搜索结果时**复用同一个 pane**（`openPathInCurrentTab` 改路径），
// 而不是每次新建 —— 否则点几次就多几格，面板会被撑爆。

/**
 * 把过滤词交给右格那个 tab（反馈 3）。
 *
 * 拆分后 tabGroup[0] = 左格（即将导航到所属目录，不该再带过滤词）、
 * tabGroup[1] = 右格（clone 出来、路径不变，负责继续显示搜索结果）。
 * 这里必须显式清理左格：`clone` 是深拷贝，上一次 reveal 留在 tabGroup[0]
 * 上的 `pendingFilterQuery` 会被一起带进左格，那会让「所属目录」也带着过滤词，
 * 看起来像没跳过去。
 *
 * 空过滤词一律写 `undefined` 而不是 `''`：FileBrowser 挂载时按「有值才接管」处理，
 * `''` 会被当成「用户想要一个空过滤器」而把过滤框打开。
 */
function handOverFilterQueryToResultsPane(
  workspacesStore: ReturnType<typeof useWorkspacesStore>,
  filterQuery: string | undefined,
): void {
  const tabGroup = workspacesStore.currentTabGroup;
  const [revealPane, resultsPane] = tabGroup ?? [];

  if (revealPane) {
    revealPane.pendingFilterQuery = undefined;
  }

  if (resultsPane) {
    resultsPane.pendingFilterQuery = filterQuery ? filterQuery : undefined;
  }
}

/**
 * 两侧都要列表样式（反馈 3，用户原话「注意都采用列表样式视图」）。
 * 标记挂在两个 tab 上，由各自的 FileBrowser 解析（见 Tab.pendingForceListLayout 的注释）。
 *
 * 两个 tab 都要标：左格是所属目录、右格是搜索结果，两边都是「看列表」的场景。
 * 只标右格的话，左格会按它自己目录记住的布局渲染，而那多半是网格 ——
 * 用户看到的仍是「一半网格一半列表」，正是反馈里要避免的形态。
 */
function forceListLayoutOnRevealPanes(
  workspacesStore: ReturnType<typeof useWorkspacesStore>,
): void {
  for (const tab of workspacesStore.currentTabGroup ?? []) {
    if (tab) {
      tab.pendingForceListLayout = true;
    }
  }
}

export function openNavigatorRevealEntry(
  router: Router,
  entryPath: string,
  options?: OpenNavigatorRevealEntryOptions,
): void {
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
      // 反馈 3：**左格**放所属目录，右格留给搜索结果。
      targetPaneIndex = 0;
      handOverFilterQueryToResultsPane(workspacesStore, options?.filterQuery);
      forceListLayoutOnRevealPanes(workspacesStore);
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
