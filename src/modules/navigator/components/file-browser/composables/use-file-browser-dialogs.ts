// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, ref, type Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';

type RenameState = {
  isActive: boolean;
  entry: DirEntry | null;
};

export function useFileBrowserDialogs(options: {
  renameState: Ref<RenameState>;
  cancelRename: () => void;
  confirmRename: (newName: string) => Promise<boolean>;
  createNewItem: (name: string, itemType: 'directory' | 'file', targetPaths?: string[]) => Promise<boolean>;
}) {
  const openWithState = ref({
    isOpen: false,
    entries: [] as DirEntry[],
  });

  const newItemDialogState = ref({
    isOpen: false,
    type: 'directory' as 'directory' | 'file',
    targetPaths: undefined as string[] | undefined,
  });

  // 批量改名的状态独立于单项改名：两者入口、语义、风险等级都不同，
  // 合成一个 state 会让「打开批量改名」不得不改写单项改名的字段。
  const batchRenameState = ref({
    isOpen: false,
    entries: [] as DirEntry[],
  });

  // FORK-MODIFICATION: 用户反馈（2026-10-15）——「添加到收藏」多一步选分类。
  // 与 batchRenameState 分开而不是合并：批量改名的风险等级是「改坏文件名」，
  // 收藏只是加一条记录，两者混在一个 state 里会逼 openBatchRenameDialog
  // 顺手改写分类字段。
  const favoriteCategoryDialogState = ref({
    isOpen: false,
    entries: [] as DirEntry[],
  });

  const isFavoriteCategoryDialogOpen = computed({
    get: () => favoriteCategoryDialogState.value.isOpen,
    set: (value: boolean) => {
      if (value) {
        favoriteCategoryDialogState.value.isOpen = true;
      }
      else {
        closeFavoriteCategoryDialog();
      }
    },
  });

  const isBatchRenameDialogOpen = computed({
    get: () => batchRenameState.value.isOpen,
    set: (value: boolean) => {
      batchRenameState.value.isOpen = value;
    },
  });

  const isRenameDialogOpen = computed({
    get: () => options.renameState.value.isActive,
    set: (value: boolean) => {
      if (!value) {
        options.cancelRename();
      }
    },
  });

  const isNewItemDialogOpen = computed({
    get: () => newItemDialogState.value.isOpen,
    set: (value: boolean) => {
      if (!value) {
        closeNewItemDialog();
      }
      else {
        newItemDialogState.value.isOpen = true;
      }
    },
  });

  function openOpenWithDialog(entries: DirEntry[]) {
    openWithState.value = {
      isOpen: true,
      entries: [...entries],
    };
  }

  function closeOpenWithDialog() {
    openWithState.value = {
      isOpen: false,
      entries: [],
    };
  }

  function openNewItemDialog(type: 'directory' | 'file', targetPaths?: string[]) {
    newItemDialogState.value = {
      isOpen: true,
      type,
      targetPaths,
    };
  }

  function closeNewItemDialog() {
    newItemDialogState.value = {
      isOpen: false,
      type: 'directory',
      targetPaths: undefined,
    };
  }

  async function handleRenameConfirm(newName: string) {
    await options.confirmRename(newName);
  }

  function handleRenameCancel() {
    options.cancelRename();
  }

  async function handleNewItemConfirm(name: string) {
    const success = await options.createNewItem(
      name,
      newItemDialogState.value.type,
      newItemDialogState.value.targetPaths,
    );

    if (success) {
      closeNewItemDialog();
    }
  }

  function handleNewItemCancel() {
    closeNewItemDialog();
  }

  /** 打开时对选中项做一份拷贝，避免用户在对话框里改动选择后条目被换掉。 */
  function openBatchRenameDialog(entries: DirEntry[]) {
    batchRenameState.value = {
      isOpen: true,
      entries: [...entries],
    };
  }

  function closeBatchRenameDialog() {
    batchRenameState.value = {
      isOpen: false,
      entries: [],
    };
  }

  /** 打开时对选中项做一份拷贝：对话框开着的时候选择可能变，不能让它看到活的数组。 */
  function openFavoriteCategoryDialog(entries: DirEntry[]) {
    favoriteCategoryDialogState.value = {
      isOpen: true,
      entries: [...entries],
    };
  }

  function closeFavoriteCategoryDialog() {
    favoriteCategoryDialogState.value = {
      isOpen: false,
      entries: [],
    };
  }

  return {
    openWithState,
    newItemDialogState,
    batchRenameState,
    favoriteCategoryDialogState,
    isRenameDialogOpen,
    isNewItemDialogOpen,
    isBatchRenameDialogOpen,
    isFavoriteCategoryDialogOpen,
    openOpenWithDialog,
    closeOpenWithDialog,
    openNewItemDialog,
    closeNewItemDialog,
    openBatchRenameDialog,
    closeBatchRenameDialog,
    openFavoriteCategoryDialog,
    closeFavoriteCategoryDialog,
    handleRenameConfirm,
    handleRenameCancel,
    handleNewItemConfirm,
    handleNewItemCancel,
  };
}
