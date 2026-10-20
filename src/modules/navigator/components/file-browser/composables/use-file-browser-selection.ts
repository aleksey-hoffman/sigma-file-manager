// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, markRaw, nextTick, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from '@/modules/navigator/components/file-browser/types';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  useClipboardStore,
  type FileOperationResult,
} from '@/stores/runtime/clipboard';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useLinkMetadataStore } from '@/stores/runtime/link-metadata';
import { useDeleteJobsStore } from '@/stores/runtime/delete-jobs';
import { useFolderTreeStore, parentDirectoryPath } from '@/stores/runtime/folder-tree';
import { toast, ToastProgress, ToastStatic } from '@/components/ui/toaster';
import { useLanShare } from '@/composables/use-lan-share';
import { useCopyMoveWithConflicts } from '@/composables/use-copy-move-with-conflicts';
import normalizePath, { joinPath } from '@/utils/normalize-path';
import { isVirtualLocationPath } from '@/utils/virtual-locations';
import {
  getSharedSourceDirectory,
  isDestinationInsideAnySourceDirectory,
} from '@/utils/file-operation-paths';
import { useFileBrowserClickSelection } from '@/modules/navigator/components/file-browser/composables/use-file-browser-click-selection';
import { blurFocusedDirEntry } from '@/modules/navigator/utils/blur-focused-dir-entry';
import { createIndexedFileName, safeFileNameFromUrl } from '@/utils/remote-file';
import { basenameFromPath } from '@/utils/source-display-name';
import { usePermanentDeleteConfirm } from '@/composables/use-permanent-delete-confirm';
// FORK-MODIFICATION 2026-10-20：远程删除。
import { useRemoteDeleteConfirm } from '@/modules/remote/utils/remote-delete-confirm';
import { deleteRemoteEntries } from '@/modules/remote/utils/remote-delete';
// FORK-MODIFICATION 2026-10-20：远程写操作（新建目录 / 重命名）。
import { createRemoteDirectory, hasRemoteTarget, renameRemoteEntry } from '@/modules/remote/utils/remote-write';
import { isRemotePath } from '@/utils/remote-paths';
import { usePlatformStore } from '@/stores/runtime/platform';
import { isContextMenuActionVisible } from '@/modules/navigator/components/file-browser/utils/context-menu-action-visibility';
import { applyBackgroundContextMenu } from '@/modules/navigator/components/file-browser/utils/file-browser-background-context-menu';
import { resolveNavigableItemTarget } from '@/utils/resolve-navigable-item-target';
import type { CreateLinksResult, LinkCreationKind } from '@/utils/link-operations';
import { getFileBrowserVisualEntryOrder } from '../file-browser-entry-groups';
import {
  applyRangeSelection,
  getEntriesInInclusiveRange,
} from '../utils/file-browser-range-selection';
import { disconnectDriveForEntry } from '@/utils/disconnect-drive';
import { refreshDrives } from '@/modules/home/composables/use-drives';
import { shouldOpenFavoriteCategoryDialog } from '@/modules/navigator/components/file-browser/utils/file-browser-favorites';

export const FILE_BROWSER_REVEAL_STALE_FOCUS_GUARD_MS = 500;

export function useFileBrowserSelection(
  entriesRef: Ref<DirEntry[]>,
  currentPathRef: Ref<string>,
  onSelect: (entries: DirEntry[]) => void,
  onOpen: (entry: DirEntry) => void,
  onOpenProperties: (entries: DirEntry[]) => void,
  // FORK-MODIFICATION: 用户反馈（2026-10-15）——「添加到收藏」多一步选分类。
  // 由 use-file-browser.ts 回填成 dialogs.openFavoriteCategoryDialog。
  onRequestFavoriteCategoryDialog: (entries: DirEntry[]) => void,
  onRefresh: () => void,
  layout?: () => 'list' | 'grid' | 'tree' | undefined,
) {
  const { t } = useI18n();
  const platformStore = usePlatformStore();
  const workspacesStore = useWorkspacesStore();
  const userStatsStore = useUserStatsStore();
  const userSettingsStore = useUserSettingsStore();
  const clipboardStore = useClipboardStore();
  const dirSizesStore = useDirSizesStore();
  const linkMetadataStore = useLinkMetadataStore();
  const deleteJobsStore = useDeleteJobsStore();
  const folderTreeStore = useFolderTreeStore();
  const { startShare } = useLanShare();
  const permanentDeleteConfirm = usePermanentDeleteConfirm();
  // FORK-MODIFICATION 2026-10-20：远程删除的确认框。**每个 FileBrowser 实例一份**，
  // 与本地的 `permanentDeleteConfirm` 同款 —— 左右双屏时两格不能共用一份待确认条目。
  const remoteDeleteConfirm = useRemoteDeleteConfirm();
  const {
    performCopyMoveWithConflicts,
    conflictDialogState,
    handleConflictResolution,
    handleConflictCancel,
    topLevelNameConflictDialogState,
    handleTopLevelNameConflictRename,
    handleTopLevelNameConflictMerge,
    handleTopLevelNameConflictCancel,
  } = useCopyMoveWithConflicts();
  const selectedEntries = ref<DirEntry[]>([]);
  const lastSelectedEntry = ref<DirEntry | null>(null);

  const contextMenu = ref({
    targetEntry: null as DirEntry | null,
    selectedEntries: [] as DirEntry[],
  });

  const renameState = ref({
    isActive: false,
    entry: null as DirEntry | null,
  });

  type PendingFocusRequest
    = {
      type: 'path';
      targetPath: string;
      path: string;
    }
    | {
      type: 'diff';
      targetPath: string;
      previousPaths: Set<string>;
    };

  const pendingFocusRequest = ref<PendingFocusRequest | null>(null);
  const focusRevealStaleRestoreGuardUntil = ref(0);

  function clearPendingFocusRequest() {
    pendingFocusRequest.value = null;
  }

  function armFocusRevealStaleRestoreGuard(
    durationMs: number = FILE_BROWSER_REVEAL_STALE_FOCUS_GUARD_MS,
  ) {
    const until = performance.now() + durationMs;
    focusRevealStaleRestoreGuardUntil.value = Math.max(
      focusRevealStaleRestoreGuardUntil.value,
      until,
    );
  }

  function requestFocusEntryAfterRefresh(parentDirectoryPath: string, entryPath: string) {
    pendingFocusRequest.value = {
      type: 'path',
      targetPath: normalizePath(parentDirectoryPath),
      path: normalizePath(entryPath),
    };
  }

  function buildJoinedPath(parentPath: string, fileName: string): string {
    return joinPath(parentPath, fileName);
  }

  async function resolveAvailableDownloadPath(
    targetPath: string,
    fileName: string,
    reservedPaths: Set<string>,
  ): Promise<string> {
    let index = 0;

    while (true) {
      const candidateFileName = createIndexedFileName(fileName, index);
      const candidatePath = normalizePath(buildJoinedPath(targetPath, candidateFileName));

      if (reservedPaths.has(candidatePath)) {
        index += 1;
        continue;
      }

      const exists = await invoke<boolean>('path_exists', { path: candidatePath });

      if (!exists) {
        reservedPaths.add(candidatePath);
        return candidatePath;
      }

      index += 1;
    }
  }

  function clearSelection() {
    selectedEntries.value = [];
    lastSelectedEntry.value = null;
    onSelect([]);
    blurFocusedDirEntry();
  }

  function isEntrySelected(entry: DirEntry): boolean {
    return selectedEntries.value.some(selectedEntry => selectedEntry.path === entry.path);
  }

  function getOrderedEntries(): DirEntry[] {
    return getFileBrowserVisualEntryOrder(entriesRef.value, layout?.());
  }

  function selectRange(fromEntry: DirEntry, toEntry: DirEntry, additive = false) {
    const rangeEntries = getEntriesInInclusiveRange(getOrderedEntries(), fromEntry, toEntry);

    if (rangeEntries.length === 0) {
      return;
    }

    selectedEntries.value = applyRangeSelection(selectedEntries.value, rangeEntries, additive);
    onSelect(selectedEntries.value);
  }

  function addToSelection(entry: DirEntry) {
    if (!isEntrySelected(entry)) {
      selectedEntries.value = [...selectedEntries.value, entry];
      lastSelectedEntry.value = entry;
      onSelect(selectedEntries.value);
    }
  }

  function removeFromSelection(entry: DirEntry) {
    selectedEntries.value = selectedEntries.value.filter(
      selectedEntry => selectedEntry.path !== entry.path,
    );

    if (lastSelectedEntry.value?.path === entry.path) {
      const lastEntry = selectedEntries.value.length > 0
        ? selectedEntries.value[selectedEntries.value.length - 1]
        : null;
      lastSelectedEntry.value = lastEntry;
    }

    onSelect(selectedEntries.value);
  }

  function replaceSelection(entry: DirEntry) {
    selectedEntries.value = [entry];
    lastSelectedEntry.value = entry;
    onSelect(selectedEntries.value);
  }

  function setSelection(entries: DirEntry[]) {
    selectedEntries.value = [...entries];
    const lastEntry = selectedEntries.value.length > 0
      ? selectedEntries.value[selectedEntries.value.length - 1]
      : null;
    lastSelectedEntry.value = lastEntry;
    onSelect(selectedEntries.value);

    if (entries.length === 0) {
      blurFocusedDirEntry();
    }
  }

  function selectEntryByPath(path: string): boolean {
    const normalizedPath = normalizePath(path);
    const targetEntry = entriesRef.value.find(
      entry => normalizePath(entry.path) === normalizedPath,
    );

    if (!targetEntry) {
      return false;
    }

    replaceSelection(targetEntry);
    return true;
  }

  const {
    mouseDownState,
    handleEntryMouseDown,
    handleEntryMouseUp,
    resetMouseState,
  } = useFileBrowserClickSelection({
    selectedEntries,
    lastSelectedEntry,
    isEntrySelected,
    selectRange,
    addToSelection,
    removeFromSelection,
    replaceSelection,
    clearSelection,
    onOpen,
    onOpenProperties,
    onMiddleClickOpenInNewTab: (entry) => {
      void openEntriesInNewTabs([entry]);
    },
    isWindows: platformStore.isWindows,
  });

  // 批量改名对话框的状态由 useFileBrowserDialogs 持有，而那个 composable
  // 在 selection 之后才创建（它反过来要用 selection 的 renameState）。
  // 用一个可后填的引用接上，好过为了开一个对话框去动 selection 的位置参数列表。
  let openBatchRenameDialogForSelection: (entries: DirEntry[]) => void = () => {};

  function handleEntryFocus(entry: DirEntry, event: FocusEvent) {
    if (pendingFocusRequest.value != null) {
      return;
    }

    if (
      performance.now() < focusRevealStaleRestoreGuardUntil.value
      && !isEntrySelected(entry)
    ) {
      return;
    }

    const target = event.currentTarget;

    if (!(target instanceof HTMLElement) || !target.matches(':focus-visible')) {
      return;
    }

    if (selectedEntries.value.length !== 1 || !isEntrySelected(entry)) {
      replaceSelection(entry);
    }
  }

  function handleEntryContextMenu(entry: DirEntry) {
    const isEntryAlreadySelected = isEntrySelected(entry);

    if (!isEntryAlreadySelected) {
      replaceSelection(entry);
    }

    contextMenu.value = {
      targetEntry: entry,
      selectedEntries: [...selectedEntries.value],
    };
  }

  function handleBackgroundContextMenu() {
    contextMenu.value = applyBackgroundContextMenu({
      clearFileSelection: clearSelection,
      currentPath: currentPathRef.value,
    });
  }

  function closeContextMenu() {
    contextMenu.value.targetEntry = null;
    contextMenu.value.selectedEntries = [];
  }

  async function openEntriesInNewTabs(entries: DirEntry[]) {
    for (const entry of entries) {
      const navigableItemTarget = await resolveNavigableItemTarget(entry.path, entry.is_file);

      if (!navigableItemTarget.opensAsFile) {
        await workspacesStore.openNewTabGroup(navigableItemTarget.targetPath, { activate: false });
      }
    }
  }

  function canPerformAction(action: ContextMenuAction, entries: DirEntry[]): boolean {
    return isContextMenuActionVisible(action, entries, {
      platform: platformStore.currentPlatform,
    });
  }

  async function disconnectDriveEntry(entry: DirEntry) {
    const result = await disconnectDriveForEntry(entry);

    if (!result.success) {
      console.error('Failed to disconnect drive:', result.error);
    }

    try {
      await refreshDrives();
      onRefresh();
    }
    catch (refreshError) {
      console.error('Failed to refresh after drive disconnect:', refreshError);
    }
  }

  function copyItems(entries: DirEntry[]) {
    if (!canPerformAction('copy', entries)) {
      return;
    }

    clipboardStore.setClipboard('copy', entries);
  }

  function cutItems(entries: DirEntry[]) {
    if (!canPerformAction('cut', entries)) {
      return;
    }

    clipboardStore.setClipboard('move', entries);
  }

  async function createLinksForEntries(
    entries: DirEntry[],
    linkKind: LinkCreationKind,
    destinationPath?: string,
  ): Promise<boolean> {
    if (entries.length === 0) {
      return false;
    }

    if (!canPerformAction('link', entries)) {
      return false;
    }

    const targetPath = destinationPath || currentPathRef.value;

    if (isDestinationInsideAnySourceDirectory(
      targetPath,
      entries.map(entry => entry.path),
      entries.map(entry => entry.is_dir),
    )) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('fileBrowser.createLinkFailed'),
            description: t('fileBrowser.cannotCreateLinkInsideItself'),
          },
        },
      });

      return false;
    }

    const shouldFocusCreatedLinks = targetPath === currentPathRef.value;
    const previousPaths = shouldFocusCreatedLinks
      ? new Set(entriesRef.value.map(entry => entry.path))
      : null;
    let result: CreateLinksResult;

    try {
      result = await invoke<CreateLinksResult>('create_links', {
        sourcePaths: entries.map(entry => entry.path),
        destinationPath: targetPath,
        linkKind,
      });
    }
    catch (error) {
      result = {
        success: false,
        createdPaths: [],
        failedItems: [{
          sourcePath: '',
          error: String(error),
        }],
      };
    }

    if (result.createdPaths.length > 0) {
      dirSizesStore.invalidate([targetPath]);
      linkMetadataStore.invalidate([
        ...entries.map(entry => entry.path),
        ...result.createdPaths,
      ]);
      workspacesStore.handleDirectoryContentsChanged([targetPath]);

      if (shouldFocusCreatedLinks && previousPaths) {
        pendingFocusRequest.value = {
          type: 'diff',
          targetPath,
          previousPaths,
        };
      }

      onRefresh();
    }

    if (result.success) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('notifications.createdNLinks', result.createdPaths.length),
            description: '',
          },
        },
      });

      return true;
    }

    if (result.createdPaths.length > 0) {
      const firstError = result.failedItems[0]?.error || t('fileBrowser.createLinkFailed');
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('notifications.createdNOfNLinks', {
              created: result.createdPaths.length,
              total: result.createdPaths.length + result.failedItems.length,
            }),
            description: t('notifications.linkCreationPartialFailureDescription', {
              count: result.failedItems.length,
              error: firstError,
            }),
          },
        },
      });

      return false;
    }

    const firstError = result.failedItems[0]?.error || t('fileBrowser.createLinkFailed');
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: t('fileBrowser.createLinkFailed'),
          description: firstError,
        },
      },
    });

    return false;
  }

  async function pasteItems(destinationPath?: string): Promise<boolean> {
    const targetPath = destinationPath || currentPathRef.value;

    if (isVirtualLocationPath(targetPath)) {
      return false;
    }

    const systemClipboard = await clipboardStore.readSystemClipboardFiles();

    if (!systemClipboard?.paths.length) {
      if (clipboardStore.hasFileItems) {
        const sourcePaths = clipboardStore.clipboardItems.map(item => item.path);
        const operation = clipboardStore.isCopyOperation ? 'copy' : 'move';
        const pasted = await handleExternalDrop(sourcePaths, targetPath, operation);

        if (pasted) {
          clipboardStore.discardClipboard();
        }

        return pasted;
      }

      return await pasteSystemClipboardImage(targetPath);
    }

    const pasted = await handleExternalDrop(
      systemClipboard.paths,
      targetPath,
      systemClipboard.operation,
    );

    if (pasted) {
      clipboardStore.discardClipboard();
    }

    return pasted;
  }

  async function pasteSystemClipboardImage(targetPath: string): Promise<boolean> {
    const shouldFocusPaste = targetPath === currentPathRef.value;
    const previousPaths = shouldFocusPaste
      ? new Set(entriesRef.value.map(entry => entry.path))
      : null;
    const result = await clipboardStore.pasteSystemClipboardImage(targetPath);

    if (!result.success) {
      if (result.error) {
        toast.error(result.error);
      }

      return false;
    }

    await dirSizesStore.refreshSizesAfterCopyMove([], targetPath, [
      targetPath,
      currentPathRef.value,
    ]);

    if (shouldFocusPaste && previousPaths) {
      if (result.path) {
        pendingFocusRequest.value = {
          type: 'path',
          targetPath,
          path: result.path,
        };
      }
      else {
        pendingFocusRequest.value = {
          type: 'diff',
          targetPath,
          previousPaths,
        };
      }
    }

    onRefresh();
    clipboardStore.discardClipboard();
    return true;
  }

  async function handleExternalDrop(sourcePaths: string[], targetPath: string, operation: 'copy' | 'move' = 'copy'): Promise<boolean> {
    if (isVirtualLocationPath(targetPath)) {
      return false;
    }

    const shouldFocusPaste = targetPath === currentPathRef.value;
    const previousPaths = shouldFocusPaste
      ? new Set(entriesRef.value.map(entry => entry.path))
      : null;
    const result = await performCopyMoveWithConflicts(sourcePaths, targetPath, operation);

    if (!result || result.cancelled) {
      return false;
    }

    if (result.copiedCount > 0) {
      const sourcesForSizes = sourcePaths.map((path, index) => ({
        path,
        is_dir: result.sourcePathIsDir[index] ?? false,
      }));
      await dirSizesStore.refreshSizesAfterCopyMove(sourcesForSizes, targetPath, [
        targetPath,
        currentPathRef.value,
      ]);
    }

    if (result.success) {
      if (shouldFocusPaste && previousPaths) {
        pendingFocusRequest.value = {
          type: 'diff',
          targetPath,
          previousPaths,
        };
      }

      onRefresh();
      return true;
    }

    if (result.copiedCount > 0) {
      onRefresh();
    }

    return false;
  }

  async function handleExternalUrlDrop(urls: string[], targetPath: string): Promise<boolean> {
    if (urls.length === 0) {
      return false;
    }

    const shouldFocusPaste = targetPath === currentPathRef.value;
    const previousPaths = shouldFocusPaste
      ? new Set(entriesRef.value.map(entry => entry.path))
      : null;

    const toastData = ref({
      id: '' as string | number,
      title: t('notifications.copyingItems'),
      description: '',
      progress: 0,
      timer: 0,
      actionText: t('cancel'),
      cleanup: () => {},
      operationType: 'copy' as 'copy' | 'move' | 'delete' | '',
      itemCount: urls.length,
    });

    toastData.value.id = toast.custom(markRaw(ToastProgress), {
      componentProps: {
        data: toastData.value,
        onAction: () => {
          if (autoDismissTimeout) {
            clearTimeout(autoDismissTimeout);
            autoDismissTimeout = null;
          }

          toast.dismiss(toastData.value.id);
        },
      },
      duration: Infinity,
    });

    let autoDismissTimeout: ReturnType<typeof setTimeout> | null = null;
    let progressInterval: ReturnType<typeof setInterval> | null = setInterval(() => {
      if (toastData.value.progress < 90) {
        toastData.value.progress += 5;
      }
    }, 100);

    toastData.value.cleanup = () => {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      if (autoDismissTimeout) {
        clearTimeout(autoDismissTimeout);
        autoDismissTimeout = null;
      }
    };

    const downloadedPaths: string[] = [];
    let lastDownloadError = '';

    try {
      await invoke('ensure_directory', { directoryPath: targetPath });

      const reservedPaths = new Set<string>();

      for (const url of urls) {
        try {
          const destinationPath = await resolveAvailableDownloadPath(
            targetPath,
            safeFileNameFromUrl(url),
            reservedPaths,
          );
          const downloadedPath = await invoke<string>('download_url_to_path', {
            url,
            destPath: destinationPath,
          });
          downloadedPaths.push(normalizePath(downloadedPath));
        }
        catch (error) {
          lastDownloadError = String(error);
        }
      }

      if (downloadedPaths.length === 0) {
        throw new Error(lastDownloadError || t('fileBrowser.copyFailed'));
      }

      toastData.value.cleanup();
      toastData.value.progress = 100;
      toastData.value.title = t('notifications.copied');
      toastData.value.itemCount = downloadedPaths.length;
      toastData.value.actionText = '';
      toastData.value.description = downloadedPaths.length < urls.length ? lastDownloadError : '';

      dirSizesStore.invalidate([targetPath, currentPathRef.value]);

      if (shouldFocusPaste && previousPaths) {
        pendingFocusRequest.value = {
          type: 'diff',
          targetPath,
          previousPaths,
        };
      }

      onRefresh();

      autoDismissTimeout = setTimeout(() => {
        toast.dismiss(toastData.value.id);
      }, downloadedPaths.length < urls.length ? 5000 : 2500);

      return downloadedPaths.length === urls.length;
    }
    catch (error) {
      toastData.value.cleanup();
      toastData.value.title = t('fileBrowser.copyFailed');
      toastData.value.description = String(error);
      toastData.value.actionText = '';
      toastData.value.progress = 0;
      toastData.value.itemCount = 0;

      setTimeout(() => {
        toast.dismiss(toastData.value.id);
      }, 5000);

      return false;
    }
  }

  function startRename(entry: DirEntry) {
    if (!canPerformAction('rename', [entry])) {
      return;
    }

    renameState.value = {
      isActive: true,
      entry,
    };
  }

  function cancelRename() {
    renameState.value = {
      isActive: false,
      entry: null,
    };
  }

  /**
   * 远程条目的改名。
   *
   * 单独一个函数而不是在 `confirmRename` 里塞一段：
   * 本地改名与远程改名的**后续动作不一样** ——
   * 本地要更新 `workspaces` / `userStats` / `userSettings` / `folderTree` 四本账，
   * 而远程条目**不在这些账里**（它们记的是本地路径）。
   * 混在一起写会出现「远程改名之后去更新本地收藏夹」这种莫名其妙的事。
   */
  async function confirmRemoteRename(entry: DirEntry, trimmedName: string): Promise<boolean> {
    const result = await renameRemoteEntry(entry, trimmedName);

    if (!result.ok) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('notifications.failedToRenameItem'),
            description: result.message,
          },
        },
      });

      return false;
    }

    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: t('notifications.renamed'),
          description: '',
        },
      },
    });

    // 远程改名**不会**改动本地那几本账 ——
    // 收藏夹、标签页、设置里记的都是本地路径。
    // 但目录树的缓存要知道「这一层变了」，否则树里还显示着旧名字。
    const parentDir = entry.path.substring(0, entry.path.lastIndexOf('/'));
    folderTreeStore.markTreeStale([parentDir]);

    cancelRename();
    clearSelection();
    onRefresh();

    return true;
  }

  async function confirmRename(newName: string): Promise<boolean> {
    if (!renameState.value.entry || !newName.trim()) {
      cancelRename();
      return false;
    }

    const entry = renameState.value.entry;
    const trimmedName = newName.trim();

    if (trimmedName === entry.name) {
      cancelRename();
      return true;
    }

    // FORK-MODIFICATION 2026-10-20：远程条目走**远程**改名通道。
    //
    // 本地的 `rename_item` 对 `sfm://remote/...` 只会得到一个「路径不存在」——
    // 那不是「功能没做」，是**接错了通道**。
    if (isRemotePath(entry.path)) {
      return confirmRemoteRename(entry, trimmedName);
    }

    try {
      const result = await invoke<FileOperationResult>('rename_item', {
        sourcePath: entry.path,
        newName: trimmedName,
      });

      if (result.success) {
        toast.custom(markRaw(ToastStatic), {
          componentProps: {
            data: {
              title: t('notifications.renamed'),
              description: '',
            },
          },
        });

        const oldPath = entry.path;
        const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const newPath = `${parentDir}/${trimmedName}`;

        workspacesStore.handlePathRenamed(oldPath, newPath);
        userStatsStore.handlePathRenamed(oldPath, newPath);
        userSettingsStore.handlePathRenamed(oldPath, newPath);
        folderTreeStore.handlePathRenamed(oldPath, newPath);

        dirSizesStore.invalidate([entry.path, currentPathRef.value]);

        // v6.5: the tree caches each directory's children and nothing ever
        // cleared them, so the renamed entry would keep showing its old name.
        folderTreeStore.markTreeStale([parentDir]);

        cancelRename();
        clearSelection();
        onRefresh();
        return true;
      }
      else {
        toast.custom(markRaw(ToastStatic), {
          componentProps: {
            data: {
              title: t('notifications.failedToRenameItem'),
              description: result.error || '',
            },
          },
        });
        return false;
      }
    }
    catch (error) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('notifications.failedToRenameItem'),
            description: String(error),
          },
        },
      });
      return false;
    }
  }

  /**
   * 在一批远程目录里新建同名目录。
   *
   * 与本地那套一样是**逐个**建、失败不影响其余 ——
   * 但远端目标**通常只有一个**（当前目录，或右键选中的那个远程目录）。
   */
  async function createRemoteDirectoryIn(
    trimmedName: string,
    directoryPaths: string[],
  ): Promise<boolean> {
    let successCount = 0;
    let lastError: string | null = null;
    const changedDirs: string[] = [];

    for (const directoryPath of directoryPaths) {
      const result = await createRemoteDirectory(trimmedName, directoryPath);

      if (result.ok) {
        successCount++;
        changedDirs.push(directoryPath);

        if (directoryPath === currentPathRef.value) {
          pendingFocusRequest.value = {
            type: 'path',
            targetPath: currentPathRef.value,
            path: `${currentPathRef.value}/${trimmedName}`,
          };
        }
      }
      else {
        lastError = result.message;
      }
    }

    if (successCount > 0) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('dialogs.newDirItemDialog.newDirectoryCreated'),
            description: '',
          },
        },
      });

      folderTreeStore.markTreeStale(changedDirs);
      onRefresh();

      return true;
    }

    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: t('dialogs.newDirItemDialog.failedToCreateNewDirectory'),
          description: lastError || '',
        },
      },
    });

    return false;
  }

  async function createNewItem(
    name: string,
    itemType: 'directory' | 'file',
    targetPaths?: string[],
  ): Promise<boolean> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return false;
    }

    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;

    if (invalidChars.test(trimmedName)) {
      return false;
    }

    if (trimmedName === '.' || trimmedName === '..') {
      return false;
    }

    const directoryPaths = targetPaths && targetPaths.length > 0
      ? targetPaths
      : [currentPathRef.value];

    if (directoryPaths.some(directoryPath => isVirtualLocationPath(directoryPath))) {
      return false;
    }

    // FORK-MODIFICATION 2026-10-20：远程目标走**远程**通道。
    //
    // 本地的 `create_item` 拿 `sfm://remote/...` 去问文件系统引擎，
    // 只会得到一句 `Directory does not exist: sfm://remote/...` ——
    // 那是「接错了通道」，不是「远程不支持建目录」。
    //
    // **「新建文件」在远程侧是永久非目标**（规格 §1），所以这里要明确报错，
    // 而不是静默失败：静默失败会让用户以为是自己名字打错了。
    if (hasRemoteTarget(directoryPaths)) {
      if (itemType === 'file') {
        toast.custom(markRaw(ToastStatic), {
          componentProps: {
            data: {
              title: t('dialogs.newDirItemDialog.failedToCreateNewFile'),
              description: t('remote.write.fileCreationNotSupported'),
            },
          },
        });

        return false;
      }

      return createRemoteDirectoryIn(trimmedName, directoryPaths);
    }

    let successCount = 0;
    let lastError: string | null = null;
    const changedDirs: string[] = [];

    for (const directoryPath of directoryPaths) {
      try {
        const result = await invoke<FileOperationResult>('create_item', {
          directoryPath,
          name: trimmedName,
          isDirectory: itemType === 'directory',
        });

        if (result.success) {
          successCount++;
          changedDirs.push(directoryPath);
          dirSizesStore.invalidate([directoryPath]);

          if (directoryPath === currentPathRef.value) {
            pendingFocusRequest.value = {
              type: 'path',
              targetPath: currentPathRef.value,
              path: `${currentPathRef.value}/${trimmedName}`,
            };
          }
        }
        else {
          lastError = result.error || '';
        }
      }
      catch (error) {
        lastError = String(error);
      }
    }

    if (successCount > 0) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: itemType === 'directory'
              ? t('dialogs.newDirItemDialog.newDirectoryCreated')
              : t('dialogs.newDirItemDialog.newFileCreated'),
            description: '',
          },
        },
      });
      // v6.5: this is the reported bug — a folder created inside an already
      // expanded directory never appeared in the tree, because the tree's
      // per-directory child cache had no way to be invalidated.
      folderTreeStore.markTreeStale(changedDirs);
      onRefresh();
      return true;
    }

    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: itemType === 'directory'
            ? t('dialogs.newDirItemDialog.failedToCreateNewDirectory')
            : t('dialogs.newDirItemDialog.failedToCreateNewFile'),
          description: lastError || '',
        },
      },
    });
    return false;
  }

  function handleContextMenuAction(action: ContextMenuAction, entriesOverride?: DirEntry[]) {
    const entries = entriesOverride ?? contextMenu.value.selectedEntries;

    switch (action) {
      case 'rename':
        if (entries.length === 1) {
          startRename(entries[0]);
        }

        break;
      case 'batch-rename':
        // 可见性规则已经保证只在多选时出现，这里再挡一次是防止
        // 快捷键或其它调用方绕过可见性判断直接派发。
        if (entries.length > 1) {
          openBatchRenameDialogForSelection(entries);
        }

        break;
      case 'copy':
        if (entries.length > 0) {
          copyItems(entries);
        }

        break;
      case 'cut':
        if (entries.length > 0) {
          cutItems(entries);
        }

        break;

      case 'paste': {
        const targetDir = entries.length === 1 && !entries[0].is_file
          ? entries[0].path
          : undefined;
        pasteItems(targetDir);
        break;
      }

      case 'delete':
        if (entries.length > 0) {
          deleteItems(entries, true);
        }

        break;
      case 'delete-permanently':
        if (entries.length > 0) {
          void deleteItems(entries, false);
        }

        break;
      // FORK-MODIFICATION 2026-10-20：远程删除。
      //
      // 刻意**不复用**上面的 `delete` / `delete-permanently`：
      // 那两个走的是本地通道（回收箱 / 本地永久删除），对 `sfm://remote/...` 路径
      // 只会得到一个「路径不存在」。远程只有一个「删除」动作。
      case 'remote-delete':
        if (entries.length > 0) {
          void deleteRemoteItems(entries);
        }

        break;
      case 'open-in-new-tab':
        if (entries.length > 0) {
          openEntriesInNewTabs(entries);
        }

        break;
      case 'toggle-favorite':
        // INVARIANT (2026-10-12 §5.5.1): toggle-favorite 唯一入口是右键菜单与
        // 快捷键。file row 上未绑 long-press / pointer-hold / touchstart handler,
        // 不会有"长按文件 → 切换置顶"的代码路径触发本 case。
        if (entries.length > 0) {
          toggleFavorites(entries);
        }

        break;
      case 'copy-path':
        if (entries.length > 0) {
          const pathText = entries.map(entry => entry.path).join('\n');
          navigator.clipboard.writeText(pathText).then(() => {
            toast.custom(markRaw(ToastStatic), {
              componentProps: {
                data: {
                  title: t('dialogs.localShareManagerDialog.addressCopiedToClipboard'),
                  description: pathText,
                },
              },
              duration: 2000,
            });
          }).catch((error) => {
            console.error('Failed to copy path:', error);
          });
        }

        break;
      case 'share':
        if (entries.length > 0 && canPerformAction('share', entries)) {
          startShare(entries);
        }

        break;
      case 'disconnect':
        if (entries.length === 1 && canPerformAction('disconnect', entries)) {
          void disconnectDriveEntry(entries[0]);
        }

        break;
    }

    void nextTick(() => {
      closeContextMenu();
    });
  }

  async function toggleFavorites(entries: DirEntry[]) {
    const allAreFavorites = entries.every(entry => userStatsStore.isFavorite(entry.path));

    // FORK-MODIFICATION: 用户反馈（2026-10-15）——收藏时要多一步选分类，
    // 于是「加」走分类对话框，「取消收藏」仍然直接做：取消不需要挑分类，
    // 多弹一次框只会让人以为还有别的事没做完。
    // 判定本身在 utils 里（可单测），这里只做接线。
    if (shouldOpenFavoriteCategoryDialog(entries, path => userStatsStore.isFavorite(path))) {
      onRequestFavoriteCategoryDialog(entries);
      return;
    }

    for (const entry of entries) {
      await userStatsStore.removeFromFavorites(entry.path);
    }

    const message = allAreFavorites
      ? t('notifications.removedFromFavorites', entries.length)
      : t('notifications.addedToFavorites', entries.length);

    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: message,
          description: '',
        },
      },
    });
  }

  function selectAll() {
    selectedEntries.value = [...entriesRef.value];
    const lastEntry = selectedEntries.value.length > 0
      ? selectedEntries.value[selectedEntries.value.length - 1]
      : null;
    lastSelectedEntry.value = lastEntry;
    onSelect(selectedEntries.value);
  }

  async function deleteItems(entries: DirEntry[], useTrash: boolean = true): Promise<boolean> {
    if (entries.length === 0) {
      return false;
    }

    const deleteAction: ContextMenuAction = useTrash ? 'delete' : 'delete-permanently';

    if (!canPerformAction(deleteAction, entries)) {
      return false;
    }

    if (!useTrash) {
      const confirmed = await permanentDeleteConfirm.requestConfirm(entries);

      if (!confirmed) {
        return false;
      }
    }

    const paths = entries.map(entry => entry.path);
    const sharedParentDirectory = getSharedSourceDirectory(paths);
    const displayPath = sharedParentDirectory
      ? basenameFromPath(sharedParentDirectory)
      : '';

    try {
      const result = await deleteJobsStore.startJob(paths, useTrash, {
        label: useTrash ? t('notifications.trashingItems') : t('notifications.deletingItems'),
        displayPath,
      });

      if (result.deletedPaths.length > 0) {
        workspacesStore.handlePathsDeleted(result.deletedPaths);
        userStatsStore.handlePathsDeleted(result.deletedPaths);
        userSettingsStore.handlePathsDeleted(result.deletedPaths);

        dirSizesStore.invalidate([currentPathRef.value, ...result.deletedPaths]);

        // v6.5: the same dead child cache that hid newly created folders also
        // kept deleted ones and stale rename targets on screen.
        const changedParents = result.deletedPaths
          .map(parentDirectoryPath)
          .filter((p): p is string => p !== null);
        folderTreeStore.markTreeStale(changedParents);

        clearSelection();
        onRefresh();
      }

      return result.success && !result.cancelled;
    }
    catch (error) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: useTrash ? t('notifications.errorTrashItems') : t('notifications.errorDeleteItems'),
            description: String(error),
          },
        },
      });

      return false;
    }
  }

  /**
   * FORK-MODIFICATION 2026-10-20：删除远程条目。
   *
   * 与本地的 `deleteItems` 有三处**刻意**不同：
   *
   * 1. **没有回收箱**，所以一定要先确认。远程删除不可撤销，
   *    误操作的代价远高于本地。
   * 2. **不走 `deleteJobsStore`**。那个 store 走的是本地文件操作通道
   *    （`trash` / 永久删除），它的进度与「已删除路径」回调都是本地的；
   *    远程条目塞进去只会得到一个永远转不出来的进度条。
   * 3. **失败要逐条报**。后端一条命令只吃一个路径，多选是前端循环，
   *    循环里第 3 个失败不该让前 2 个的成功显示不出来。
   */
  async function deleteRemoteItems(entries: DirEntry[]): Promise<boolean> {
    const remoteEntries = entries.filter(entry => isRemotePath(entry.path));

    if (remoteEntries.length === 0) {
      return false;
    }

    const confirmed = await remoteDeleteConfirm.requestConfirm(remoteEntries);

    if (!confirmed) {
      return false;
    }

    const report = await deleteRemoteEntries(remoteEntries);

    if (report.failures.length > 0) {
      const denied = report.failures.some(failure => failure.kind === 'permission');

      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: denied
              ? t('remote.delete.permissionDenied')
              : t('remote.delete.failed'),
            description: report.failures
              .map(failure => `${failure.path}: ${failure.message}`)
              .join('\n'),
          },
        },
        duration: 6000,
      });
    }

    if (report.deleted.length > 0) {
      toast.custom(markRaw(ToastStatic), {
        componentProps: {
          data: {
            title: t('remote.delete.success', { count: report.deleted.length }),
            description: '',
          },
        },
      });

      clearSelection();
      onRefresh();
    }

    return report.deleted.length > 0;
  }

  function performSelectionAction(action: ContextMenuAction) {
    const entries = selectedEntries.value;

    if (entries.length === 0) {
      return;
    }

    if (!canPerformAction(action, entries)) {
      return;
    }

    handleContextMenuAction(action, entries);
  }

  return {
    selectedEntries,
    lastSelectedEntry,
    mouseDownState,
    contextMenu,
    renameState,
    clearSelection,
    isEntrySelected,
    replaceSelection,
    setSelection,
    handleEntryMouseDown,
    handleEntryMouseUp,
    handleEntryFocus,
    handleEntryContextMenu,
    handleBackgroundContextMenu,
    closeContextMenu,
    handleContextMenuAction,
    performSelectionAction,
    resetMouseState,
    selectAll,
    selectEntryByPath,
    removeFromSelection,
    copyItems,
    cutItems,
    createLinksForEntries,
    pasteItems,
    handleExternalDrop,
    handleExternalUrlDrop,
    deleteItems,
    startRename,
    cancelRename,
    confirmRename,
    createNewItem,
    pendingFocusRequest,
    clearPendingFocusRequest,
    requestFocusEntryAfterRefresh,
    armFocusRevealStaleRestoreGuard,
    conflictDialogState,
    handleConflictResolution,
    handleConflictCancel,
    topLevelNameConflictDialogState,
    handleTopLevelNameConflictRename,
    handleTopLevelNameConflictMerge,
    handleTopLevelNameConflictCancel,
    permanentDeleteConfirm,
    // FORK-MODIFICATION 2026-10-20：远程删除的确认框状态。
    remoteDeleteConfirm,
    setOpenBatchRenameDialogHandler(handler: (entries: DirEntry[]) => void) {
      openBatchRenameDialogForSelection = handler;
    },
  };
}
