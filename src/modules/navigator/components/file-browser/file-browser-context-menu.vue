<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, nextTick } from 'vue';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '@/components/ui/context-menu';
import FileBrowserActionsMenu from './file-browser-actions-menu.vue';
import type { ContextMenuItemRegistration } from '@/types/extension';
import FileBrowserExtensionMenuItems from './file-browser-extension-menu-items.vue';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import { arePathsEquivalent } from '@/utils/file-operation-paths';
// FORK-MODIFICATION 2026-10-20：创建类动作要过门禁（交接文档 §7.1）。
import { isActionBlockedByEntryPolicy } from '@/utils/entry-action-policy';
import type { LinkCreationKind } from '@/utils/link-operations';

const ctx = useFileBrowserContext();

const isCurrentDirectoryContext = computed(() => {
  const entries = ctx.contextMenu.value.selectedEntries;
  if (entries.length !== 1) return false;

  const entry = entries[0];
  return entry.is_dir && arePathsEquivalent(entry.path, ctx.currentPath.value);
});

function handleAction(action: Parameters<typeof ctx.onContextMenuAction>[0]) {
  if (action === 'create-file' || action === 'create-directory') {
    const selectedEntries = ctx.contextMenu.value.selectedEntries;
    const targetPaths = selectedEntries
      .filter(entry => entry.is_dir)
      .map(entry => entry.path);

    // FORK-MODIFICATION 2026-10-20：创建类动作**必须**过门禁。
    //
    // 之前这三个调用点（这里、状态栏、目录树的条目菜单）都直接 emit，
    // `isActionBlockedByEntryPolicy` 压根没被调用 ——
    // 于是「新建文件」在远程目录里照常出现，点下去得到一句
    // `Directory does not exist: sfm://remote/...`（交接文档 §7.1）。
    //
    // 平台传 `null` 是安全的：远程策略在 `getEntryActionPolicy` 里**排第一**，
    // 根本轮不到 `isProtectedSystemPath` 去用平台。
    if (isActionBlockedByEntryPolicy(action, selectedEntries, null)) {
      return;
    }

    ctx.openNewItemDialog(action === 'create-file' ? 'file' : 'directory', targetPaths);
    return;
  }

  ctx.onContextMenuAction(action);
}

function handleOpenCustomDialog() {
  ctx.openOpenWithDialog(ctx.contextMenu.value.selectedEntries);
}

async function handleCreateLink(linkKind: LinkCreationKind) {
  const entries = [...ctx.contextMenu.value.selectedEntries];

  void nextTick(() => {
    ctx.closeContextMenu();
  });

  await ctx.createLinksForEntries(entries, linkKind, ctx.currentPath.value);
}

async function handleExtensionAction(registration: ContextMenuItemRegistration) {
  const context = {
    selectedEntries: ctx.contextMenu.value.selectedEntries.map(entry => ({
      path: entry.path,
      name: entry.name,
      isDirectory: entry.is_dir,
      size: entry.size,
      extension: entry.ext ?? undefined,
    })),
  };

  try {
    await registration.handler(context);
  }
  catch (error) {
    console.error('Extension action failed:', error);
  }
}
</script>

<template>
  <ContextMenuContent class="file-browser-context-menu">
    <FileBrowserActionsMenu
      :selected-entries="ctx.contextMenu.value.selectedEntries"
      :menu-item-component="ContextMenuItem"
      :menu-separator-component="ContextMenuSeparator"
      :is-current-directory-context="isCurrentDirectoryContext"
      :is-search-results-view="ctx.isSearchResultsView.value"
      @action="handleAction"
      @create-link="handleCreateLink"
      @open-custom-dialog="handleOpenCustomDialog"
    />
    <FileBrowserExtensionMenuItems
      :selected-entries="ctx.contextMenu.value.selectedEntries"
      :menu-item-component="ContextMenuItem"
      :menu-separator-component="ContextMenuSeparator"
      :menu-label-component="ContextMenuLabel"
      @extension-action="handleExtensionAction"
    />
  </ContextMenuContent>
</template>

<style>
.file-browser-context-menu.sigma-ui-context-menu-content {
  min-width: 250px;
  max-width: 300px;
  padding: 8px;
}
</style>
