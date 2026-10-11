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

  return {
    openWithState,
    newItemDialogState,
    batchRenameState,
    isRenameDialogOpen,
    isNewItemDialogOpen,
    isBatchRenameDialogOpen,
    openOpenWithDialog,
    closeOpenWithDialog,
    openNewItemDialog,
    closeNewItemDialog,
    openBatchRenameDialog,
    closeBatchRenameDialog,
    handleRenameConfirm,
    handleRenameCancel,
    handleNewItemConfirm,
    handleNewItemCancel,
  };
}
