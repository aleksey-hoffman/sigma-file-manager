// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';

export type ClipboardOperationType = 'copy' | 'move' | '';

export interface ClipboardState {
  type: ClipboardOperationType;
  items: DirEntry[];
}

export interface FileOperationResult {
  success: boolean;
  error?: string;
  copied_count?: number;
  failed_count?: number;
}

/**
 * Gets the parent directory path from a file/folder path
 */
function getParentPath(path: string): string {
  // Normalize path separators
  const normalizedPath = path.replace(/\\/g, '/');
  const lastSeparatorIndex = normalizedPath.lastIndexOf('/');
  if (lastSeparatorIndex <= 0) {
    return normalizedPath;
  }
  return normalizedPath.substring(0, lastSeparatorIndex);
}

/**
 * Normalizes a path for comparison (handles Windows/Unix differences)
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}

export const useClipboardStore = defineStore('clipboard', () => {
  const clipboardType = ref<ClipboardOperationType>('');
  const clipboardItems = ref<DirEntry[]>([]);
  const isOperationInProgress = ref(false);

  const hasItems = computed(() => clipboardItems.value.length > 0);
  const itemCount = computed(() => clipboardItems.value.length);
  const isCopyOperation = computed(() => clipboardType.value === 'copy');
  const isMoveOperation = computed(() => clipboardType.value === 'move');

  /**
   * Gets the source directory (parent directory of clipboard items)
   * Returns null if items are from different directories
   */
  const sourceDirectory = computed(() => {
    if (clipboardItems.value.length === 0) {
      return null;
    }

    const firstItemParent = getParentPath(clipboardItems.value[0].path);
    const allFromSameDir = clipboardItems.value.every(
      item => normalizePath(getParentPath(item.path)) === normalizePath(firstItemParent),
    );

    return allFromSameDir ? firstItemParent : null;
  });

  function setClipboard(type: ClipboardOperationType, items: DirEntry[]) {
    clipboardType.value = type;
    clipboardItems.value = items.map(item => ({ ...item }));
  }

  function addToClipboard(type: ClipboardOperationType, items: DirEntry[]) {
    clipboardType.value = type;
    for (const item of items) {
      const itemAlreadyAdded = clipboardItems.value.some(
        clipboardItem => clipboardItem.path === item.path,
      );
      if (!itemAlreadyAdded) {
        clipboardItems.value.push({ ...item });
      }
    }
  }

  function removeFromClipboard(item: DirEntry) {
    clipboardItems.value = clipboardItems.value.filter(
      clipboardItem => clipboardItem.path !== item.path,
    );
    if (clipboardItems.value.length === 0) {
      clearClipboard();
    }
  }

  function clearClipboard() {
    clipboardType.value = '';
    clipboardItems.value = [];
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
    return normalizePath(destinationPath) === normalizePath(sourceDirectory.value);
  }

  /**
   * Checks if destination is inside one of the clipboard items
   * (can't move/copy a folder into itself)
   */
  function isDestinationInsideClipboardItem(destinationPath: string): boolean {
    const normalizedDest = normalizePath(destinationPath);
    return clipboardItems.value.some((item) => {
      if (!item.is_dir) {
        return false;
      }
      const normalizedItemPath = normalizePath(item.path);
      return normalizedDest.startsWith(normalizedItemPath + '/');
    });
  }

  /**
   * Checks if paste operation is allowed for the given destination
   */
  function canPasteTo(destinationPath: string): boolean {
    if (!hasItems.value) {
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

  async function pasteItems(destinationPath: string): Promise<FileOperationResult> {
    if (!hasItems.value) {
      return { success: false, error: 'No items in clipboard' };
    }

    // Validate paste operation
    if (isDestinationInsideClipboardItem(destinationPath)) {
      return { success: false, error: 'Cannot paste a folder into itself' };
    }

    if (isMoveOperation.value && isSameAsSourceDirectory(destinationPath)) {
      return { success: false, error: 'Cannot move items to the same directory' };
    }

    const sourcePaths = clipboardItems.value.map(item => item.path);
    isOperationInProgress.value = true;

    try {
      if (clipboardType.value === 'copy') {
        const result = await invoke<FileOperationResult>('copy_items', {
          sourcePaths,
          destinationPath,
        });

        return result;
      }
      else if (clipboardType.value === 'move') {
        const result = await invoke<FileOperationResult>('move_items', {
          sourcePaths,
          destinationPath,
        });

        if (result.success) {
          clearClipboard();
        }

        return result;
      }

      return { success: false, error: 'Invalid clipboard operation type' };
    }
    catch (error) {
      return { success: false, error: String(error) };
    }
    finally {
      isOperationInProgress.value = false;
    }
  }

  return {
    clipboardType,
    clipboardItems,
    isOperationInProgress,
    hasItems,
    itemCount,
    isCopyOperation,
    isMoveOperation,
    sourceDirectory,
    setClipboard,
    addToClipboard,
    removeFromClipboard,
    clearClipboard,
    isItemInClipboard,
    isSameAsSourceDirectory,
    isDestinationInsideClipboardItem,
    canPasteTo,
    pasteItems,
  };
});
