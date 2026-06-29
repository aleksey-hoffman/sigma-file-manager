// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Router } from 'vue-router';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
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
