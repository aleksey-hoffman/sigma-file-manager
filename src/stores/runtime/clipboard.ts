// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';
import { i18n } from '@/localization';
import {
  arePathsEquivalent,
  getParentPath,
  getSharedSourceDirectory,
  isDestinationInsideAnySourceDirectory,
} from '@/utils/file-operation-paths';
import { getPathLeafName } from '@/utils/normalize-path';

export type ClipboardOperationType = 'copy' | 'move' | '';
export type ConflictResolution = 'replace' | 'skip' | 'auto-rename';

export interface PathResolutionEntry {
  destination_path: string;
  resolution: ConflictResolution;
}

export type ConflictResolutionPayload = {
  perPathResolutions: PathResolutionEntry[];
};

export interface ClipboardState {
  type: ClipboardOperationType;
  items: DirEntry[];
}

export interface FileOperationResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  copied_count?: number;
  failed_count?: number;
  skipped_count?: number;
  fromStatusCenterJob?: boolean;
}

export interface SystemClipboardImagePasteResult extends FileOperationResult {
  path?: string | null;
}

export interface SystemClipboardImageInfo {
  width: number;
  height: number;
  sizeBytes: number;
  clipboardSequence?: number | null;
  tempPath?: string | null;
  tempVersion?: number | null;
  savedSizeBytes?: number | null;
}

export interface SystemClipboardSavedImage {
  path: string;
  sizeBytes: number;
}

export interface ConflictItem {
  source_path: string;
  source_name: string;
  source_is_dir: boolean;
  source_size: number | null;
  source_modified_ms: number | null;
  destination_path: string;
  destination_is_dir: boolean;
  destination_size: number | null;
  destination_modified_ms: number | null;
  relative_path: string;
}

export const useClipboardStore = defineStore('clipboard', () => {
  const clipboardType = ref<ClipboardOperationType>('');
  const clipboardItems = ref<DirEntry[]>([]);
  const clipboardImage = ref<SystemClipboardImageInfo | null>(null);
  const isOperationInProgress = ref(false);
  const isToolbarSuppressed = ref(false);
  let pendingSystemClipboardMutation: Promise<void> | null = null;
  let pendingSystemClipboardImageSave: Promise<SystemClipboardImageInfo | null> | null = null;

  const hasFileItems = computed(() => clipboardItems.value.length > 0);
  const hasImageContent = computed(() => clipboardImage.value !== null);
  const hasItems = computed(() => hasFileItems.value || hasImageContent.value);
  const showToolbar = computed(() => hasItems.value && !isToolbarSuppressed.value);
  const itemCount = computed(() => hasImageContent.value ? 1 : clipboardItems.value.length);
  const isCopyOperation = computed(() => clipboardType.value === 'copy');
  const isMoveOperation = computed(() => clipboardType.value === 'move');

  /**
   * Gets the source directory (parent directory of clipboard items)
   * Returns null if items are from different directories
   */
  const sourceDirectory = computed(() =>
    getSharedSourceDirectory(clipboardItems.value.map(item => item.path)),
  );

  function setClipboard(
    type: ClipboardOperationType,
    items: DirEntry[],
    options?: {
      keepToolbarHidden?: boolean;
      syncToSystemClipboard?: boolean;
    },
  ) {
    clipboardType.value = type;
    clipboardItems.value = items.map(item => ({ ...item }));
    clipboardImage.value = null;
    isToolbarSuppressed.value = options?.keepToolbarHidden === true;

    if (options?.syncToSystemClipboard !== false) {
      void syncToSystemClipboard();
    }
  }

  function addToClipboard(
    type: ClipboardOperationType,
    items: DirEntry[],
    options?: {
      keepToolbarHidden?: boolean;
      syncToSystemClipboard?: boolean;
    },
  ) {
    clipboardType.value = type;
    clipboardImage.value = null;
    isToolbarSuppressed.value = options?.keepToolbarHidden === true;

    for (const item of items) {
      const itemAlreadyAdded = clipboardItems.value.some(
        clipboardItem => clipboardItem.path === item.path,
      );

      if (!itemAlreadyAdded) {
        clipboardItems.value.push({ ...item });
      }
    }

    if (options?.syncToSystemClipboard !== false) {
      void syncToSystemClipboard();
    }
  }

  function removeFromClipboard(item: DirEntry) {
    clipboardItems.value = clipboardItems.value.filter(
      clipboardItem => clipboardItem.path !== item.path,
    );

    if (clipboardItems.value.length === 0) {
      discardClipboard();
      return;
    }

    void syncToSystemClipboard();
  }

  function clearClipboard() {
    clipboardType.value = '';
    clipboardItems.value = [];
    clipboardImage.value = null;
    isToolbarSuppressed.value = false;
  }

  function trackSystemClipboardMutation(mutation: Promise<void>): Promise<void> {
    const trackedMutation = mutation.finally(() => {
      if (pendingSystemClipboardMutation === trackedMutation) {
        pendingSystemClipboardMutation = null;
      }
    });

    pendingSystemClipboardMutation = trackedMutation;
    return trackedMutation;
  }

  async function waitForPendingSystemClipboardMutation(): Promise<void> {
    const pendingMutation = pendingSystemClipboardMutation;

    if (pendingMutation) {
      await pendingMutation;
    }
  }

  async function clearSystemClipboardFiles(): Promise<void> {
    await trackSystemClipboardMutation((async () => {
      try {
        await invoke('clear_system_clipboard_files');
      }
      catch (error) {
        console.error('Failed to clear system clipboard files:', error);
      }
    })());
  }

  function discardClipboard() {
    clearClipboard();
    void clearSystemClipboardFiles();
  }

  function snapshotClipboard(): {
    type: ClipboardOperationType;
    items: DirEntry[];
    image: SystemClipboardImageInfo | null;
    suppressed: boolean;
  } {
    return {
      type: clipboardType.value,
      items: clipboardItems.value.map(item => ({ ...item })),
      image: clipboardImage.value ? { ...clipboardImage.value } : null,
      suppressed: isToolbarSuppressed.value,
    };
  }

  function restoreClipboardFromSnapshot(snapshot: ReturnType<typeof snapshotClipboard>) {
    clipboardType.value = snapshot.type;
    clipboardItems.value = snapshot.items;
    clipboardImage.value = snapshot.image ? { ...snapshot.image } : null;
    isToolbarSuppressed.value = snapshot.suppressed;
  }

  function isTransientClipboardAccessError(error: unknown): boolean {
    const message = String(error);

    return message.includes('OpenClipboard failed')
      && message.includes('Access is denied');
  }

  async function readSystemClipboardFiles(): Promise<{
    paths: string[];
    operation: 'copy' | 'move';
  } | null> {
    try {
      const result = await invoke<{
        paths: string[];
        operation: string;
      }>('read_system_clipboard_files');

      return {
        paths: result.paths,
        operation: result.operation === 'move' ? 'move' : 'copy',
      };
    }
    catch (error) {
      if (!isTransientClipboardAccessError(error)) {
        console.error('Failed to read system clipboard files:', error);
      }

      return null;
    }
  }

  async function readSystemClipboardImageInfo(): Promise<SystemClipboardImageInfo | null> {
    try {
      return await invoke<SystemClipboardImageInfo | null>('read_system_clipboard_image_info');
    }
    catch (error) {
      console.error('Failed to read system clipboard image:', error);
      return null;
    }
  }

  async function saveSystemClipboardImageToTemp(): Promise<SystemClipboardSavedImage | null> {
    try {
      return await invoke<SystemClipboardSavedImage | null>('save_system_clipboard_image_to_temp');
    }
    catch (error) {
      console.error('Failed to save system clipboard image:', error);
      return null;
    }
  }

  function setClipboardImage(imageInfo: SystemClipboardImageInfo) {
    clipboardType.value = 'copy';
    clipboardItems.value = [];
    clipboardImage.value = { ...imageInfo };
    isToolbarSuppressed.value = false;
  }

  async function syncToSystemClipboard(): Promise<void> {
    if (!clipboardItems.value.length || !clipboardType.value) {
      return;
    }

    const paths = clipboardItems.value.map(item => item.path);
    const operation = clipboardType.value === 'move' ? 'move' : 'copy';

    await trackSystemClipboardMutation((async () => {
      try {
        await invoke('set_system_clipboard_files', {
          paths,
          operation,
        });
      }
      catch (error) {
        console.error('Failed to sync system clipboard:', error);
      }
    })());
  }

  async function pasteSystemClipboardImage(destinationPath: string): Promise<SystemClipboardImagePasteResult> {
    const savedImage = await ensureSystemClipboardImageSaved();

    if (!savedImage?.tempPath) {
      return {
        success: false,
        error: i18n.global.t('fileBrowser.noItemsInClipboard'),
        copied_count: 0,
        failed_count: 1,
        skipped_count: 0,
        path: null,
      };
    }

    return await pasteSavedClipboardImage(savedImage.tempPath, destinationPath);
  }

  async function pasteSavedClipboardImage(
    sourcePath: string,
    destinationPath: string,
  ): Promise<SystemClipboardImagePasteResult> {
    try {
      return await invoke<SystemClipboardImagePasteResult>('paste_saved_clipboard_image', {
        sourcePath,
        destinationPath,
      });
    }
    catch (error) {
      return {
        success: false,
        error: String(error),
        copied_count: 0,
        failed_count: 1,
        skipped_count: 0,
        path: null,
      };
    }
  }

  function createFallbackClipboardEntry(path: string, isDirectory: boolean): DirEntry {
    return {
      name: getPathLeafName(path) || path,
      ext: null,
      path,
      size: 0,
      item_count: null,
      modified_time: 0,
      accessed_time: 0,
      created_time: 0,
      mime: null,
      is_file: !isDirectory,
      is_dir: isDirectory,
      is_symlink: false,
      is_hidden: false,
      link_type: null,
      link_target: null,
      link_status: null,
      hard_link_count: null,
    };
  }

  async function createClipboardEntriesFromPaths(paths: string[]): Promise<DirEntry[]> {
    let pathIsDirectory: boolean[];

    try {
      pathIsDirectory = await invoke<boolean[]>('paths_are_directories', {
        paths,
      });
    }
    catch {
      pathIsDirectory = paths.map(() => false);
    }

    return await Promise.all(paths.map(async (path, pathIndex) => {
      try {
        return await invoke<DirEntry>('get_dir_entry_with_timeout', {
          path,
          timeoutMs: 1000,
        });
      }
      catch {
        return createFallbackClipboardEntry(path, pathIsDirectory[pathIndex] ?? false);
      }
    }));
  }

  async function refreshAfterExternalClipboardConsumption(sourcePaths: string[]): Promise<void> {
    const parentDirectories = [...new Set(sourcePaths.map(path => getParentPath(path)))];

    const { useWorkspacesStore } = await import('@/stores/storage/workspaces');
    const { useDirSizesStore } = await import('@/stores/runtime/dir-sizes');
    const workspacesStore = useWorkspacesStore();
    const dirSizesStore = useDirSizesStore();

    workspacesStore.handleDirectoryContentsChanged(parentDirectories);
    dirSizesStore.invalidate(sourcePaths);
  }

  async function areClipboardSourcePathsMissing(sourcePaths: string[]): Promise<boolean> {
    if (sourcePaths.length === 0) {
      return false;
    }

    const pathExistsResults = await Promise.all(sourcePaths.map(async (sourcePath) => {
      try {
        return await invoke<boolean>('path_exists', {
          path: sourcePath,
        });
      }
      catch {
        return true;
      }
    }));

    return pathExistsResults.every(pathExists => !pathExists);
  }

  async function checkExternalClipboardConsumption(): Promise<boolean> {
    if (!hasFileItems.value || isOperationInProgress.value) {
      return false;
    }

    const sourcePaths = clipboardItems.value.map(item => item.path);

    if (isMoveOperation.value && await areClipboardSourcePathsMissing(sourcePaths)) {
      discardClipboard();
      await refreshAfterExternalClipboardConsumption(sourcePaths);
      return true;
    }

    const systemClipboard = await readSystemClipboardFiles();

    if (!systemClipboard) {
      return false;
    }

    if (systemClipboard.paths.length === 0) {
      discardClipboard();
      return true;
    }

    return false;
  }

  async function syncFromSystemClipboard(): Promise<void> {
    await waitForPendingSystemClipboardMutation();

    if (await checkExternalClipboardConsumption()) {
      return;
    }

    const systemClipboard = await readSystemClipboardFiles();

    if (!systemClipboard) {
      return;
    }

    if (systemClipboard.paths.length === 0) {
      const systemClipboardImage = await readSystemClipboardImageInfo();

      if (systemClipboardImage) {
        setClipboardImage(getClipboardImageWithSavedFile(systemClipboardImage));
        return;
      }

      clearClipboard();
      return;
    }

    if (systemClipboard.operation !== 'copy' && systemClipboard.operation !== 'move') {
      clearClipboard();
      return;
    }

    const systemClipboardItems = await createClipboardEntriesFromPaths(systemClipboard.paths);

    if (systemClipboardItems.length === 0) {
      clearClipboard();
      return;
    }

    clipboardType.value = systemClipboard.operation;
    clipboardItems.value = systemClipboardItems;
    clipboardImage.value = null;
    isToolbarSuppressed.value = false;
  }

  function canReuseSavedClipboardImage(imageInfo: SystemClipboardImageInfo): boolean {
    const currentImage = clipboardImage.value;

    if (!currentImage?.tempPath) {
      return false;
    }

    return isSameClipboardImage(currentImage, imageInfo);
  }

  function isSameClipboardImage(
    currentImage: SystemClipboardImageInfo,
    imageInfo: SystemClipboardImageInfo,
  ): boolean {
    if (
      currentImage.clipboardSequence !== undefined
      && currentImage.clipboardSequence !== null
      && imageInfo.clipboardSequence !== undefined
      && imageInfo.clipboardSequence !== null
    ) {
      return currentImage.clipboardSequence === imageInfo.clipboardSequence;
    }

    return currentImage.width === imageInfo.width
      && currentImage.height === imageInfo.height
      && currentImage.sizeBytes === imageInfo.sizeBytes;
  }

  function getClipboardImageWithSavedFile(imageInfo: SystemClipboardImageInfo): SystemClipboardImageInfo {
    if (!canReuseSavedClipboardImage(imageInfo)) {
      return imageInfo;
    }

    return {
      ...imageInfo,
      tempPath: clipboardImage.value?.tempPath,
      tempVersion: clipboardImage.value?.tempVersion,
      savedSizeBytes: clipboardImage.value?.savedSizeBytes,
    };
  }

  async function saveSystemClipboardImage(
    imageInfo: SystemClipboardImageInfo,
  ): Promise<SystemClipboardImageInfo> {
    if (canReuseSavedClipboardImage(imageInfo)) {
      return {
        ...imageInfo,
        tempPath: clipboardImage.value?.tempPath,
        tempVersion: clipboardImage.value?.tempVersion,
        savedSizeBytes: clipboardImage.value?.savedSizeBytes,
      };
    }

    const savedImage = await saveSystemClipboardImageToTemp();

    if (!clipboardImage.value || !isSameClipboardImage(clipboardImage.value, imageInfo)) {
      return imageInfo;
    }

    const savedClipboardImage = {
      ...imageInfo,
      tempPath: savedImage?.path ?? null,
      tempVersion: savedImage ? Date.now() : null,
      savedSizeBytes: savedImage?.sizeBytes ?? null,
    };
    clipboardImage.value = savedClipboardImage;

    return savedClipboardImage;
  }

  async function ensureSystemClipboardImageSaved(): Promise<SystemClipboardImageInfo | null> {
    if (!clipboardImage.value) {
      return null;
    }

    if (clipboardImage.value.tempPath) {
      return clipboardImage.value;
    }

    if (pendingSystemClipboardImageSave) {
      return pendingSystemClipboardImageSave;
    }

    const imageInfo = { ...clipboardImage.value };
    pendingSystemClipboardImageSave = saveSystemClipboardImage(imageInfo).finally(() => {
      pendingSystemClipboardImageSave = null;
    });

    return pendingSystemClipboardImageSave;
  }

  function isItemInClipboard(item: DirEntry): boolean {
    return clipboardItems.value.some(
      clipboardItem => clipboardItem.path === item.path,
    );
  }

  /**
   * Checks if the destination is the same as the source directory
   * (only relevant for move operations - can't move items to same location)
   */
  function isSameAsSourceDirectory(destinationPath: string): boolean {
    if (!sourceDirectory.value) {
      return false;
    }

    return arePathsEquivalent(destinationPath, sourceDirectory.value);
  }

  /**
   * Checks if destination is inside one of the clipboard items
   * (can't move/copy a folder into itself)
   */
  function isDestinationInsideClipboardItem(destinationPath: string): boolean {
    return isDestinationInsideAnySourceDirectory(
      destinationPath,
      clipboardItems.value.map(item => item.path),
      clipboardItems.value.map(item => item.is_dir),
    );
  }

  /**
   * Checks if paste operation is allowed for the given destination
   */
  function canPasteTo(destinationPath: string): boolean {
    if (hasImageContent.value) {
      return Boolean(destinationPath);
    }

    if (!hasItems.value || (!isCopyOperation.value && !isMoveOperation.value)) {
      return false;
    }

    // Can't paste into a folder that's in the clipboard
    if (isDestinationInsideClipboardItem(destinationPath)) {
      return false;
    }

    // For move operations, can't move to the same directory
    if (isMoveOperation.value && isSameAsSourceDirectory(destinationPath)) {
      return false;
    }

    return true;
  }

  async function checkConflicts(destinationPath: string): Promise<ConflictItem[]> {
    if (!hasItems.value || hasImageContent.value) {
      return [];
    }

    const sourcePaths = clipboardItems.value.map(item => item.path);

    return await invoke<ConflictItem[]>('check_conflicts', {
      sourcePaths,
      destinationPath,
    });
  }

  async function pasteItems(
    destinationPath: string,
    perPathResolutions?: PathResolutionEntry[],
  ): Promise<FileOperationResult> {
    if (hasImageContent.value) {
      const result = await pasteSystemClipboardImage(destinationPath);

      if (result.success) {
        discardClipboard();
      }

      return result;
    }

    if (!hasItems.value) {
      return {
        success: false,
        error: i18n.global.t('fileBrowser.noItemsInClipboard'),
      };
    }

    if (isDestinationInsideClipboardItem(destinationPath)) {
      return {
        success: false,
        error: i18n.global.t('fileBrowser.cannotPasteIntoItself'),
      };
    }

    if (isMoveOperation.value && isSameAsSourceDirectory(destinationPath)) {
      return {
        success: false,
        error: i18n.global.t('fileBrowser.cannotMoveToSameDirectory'),
      };
    }

    const sourcePaths = clipboardItems.value.map(item => item.path);
    const operationType = clipboardType.value;
    const clipboardSnapshot = snapshotClipboard();
    isOperationInProgress.value = true;

    const displayPath = destinationPath.split(/[/\\]/).pop() ?? destinationPath;

    if (operationType !== 'copy' && operationType !== 'move') {
      isOperationInProgress.value = false;
      return {
        success: false,
        error: i18n.global.t('fileBrowser.invalidClipboardOperation'),
      };
    }

    clearClipboard();

    try {
      const { useCopyMoveJobsStore } = await import('@/stores/runtime/copy-move-jobs');
      const copyMoveJobsStore = useCopyMoveJobsStore();

      const result = await copyMoveJobsStore.startJob(
        operationType,
        sourcePaths,
        destinationPath,
        null,
        perPathResolutions,
        {
          label: operationType === 'copy'
            ? i18n.global.t('notifications.copyingItems')
            : i18n.global.t('notifications.movingItems'),
          displayPath,
        },
      );

      if (!result.success && !clipboardItems.value.length) {
        restoreClipboardFromSnapshot(clipboardSnapshot);
      }

      if (result.success) {
        discardClipboard();
      }

      return result;
    }
    catch (error) {
      if (!clipboardItems.value.length) {
        restoreClipboardFromSnapshot(clipboardSnapshot);
      }

      return {
        success: false,
        error: String(error),
      };
    }
    finally {
      isOperationInProgress.value = false;
    }
  }

  return {
    clipboardType,
    clipboardItems,
    clipboardImage,
    isOperationInProgress,
    isToolbarSuppressed,
    hasFileItems,
    hasImageContent,
    hasItems,
    showToolbar,
    itemCount,
    isCopyOperation,
    isMoveOperation,
    sourceDirectory,
    setClipboard,
    addToClipboard,
    removeFromClipboard,
    clearClipboard,
    discardClipboard,
    isItemInClipboard,
    isSameAsSourceDirectory,
    isDestinationInsideClipboardItem,
    canPasteTo,
    checkConflicts,
    pasteItems,
    readSystemClipboardFiles,
    readSystemClipboardImageInfo,
    saveSystemClipboardImageToTemp,
    ensureSystemClipboardImageSaved,
    setClipboardImage,
    pasteSystemClipboardImage,
    pasteSavedClipboardImage,
    syncToSystemClipboard,
    syncFromSystemClipboard,
    checkExternalClipboardConsumption,
    clearSystemClipboardFiles,
  };
});
