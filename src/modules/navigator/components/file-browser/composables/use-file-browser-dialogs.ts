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
  createNewItem: (name: string, itemType: 'directory' | 'file') => Promise<boolean>;
}) {
  const openWithState = ref({
    isOpen: false,
    entries: [] as DirEntry[],
  });

  const newItemDialogState = ref({
    isOpen: false,
    type: 'directory' as 'directory' | 'file',
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

  function openNewItemDialog(type: 'directory' | 'file') {
    newItemDialogState.value = {
      isOpen: true,
      type,
    };
  }

  function closeNewItemDialog() {
    newItemDialogState.value.isOpen = false;
  }

  async function handleRenameConfirm(newName: string) {
    await options.confirmRename(newName);
  }

  function handleRenameCancel() {
    options.cancelRename();
  }

  async function handleNewItemConfirm(name: string) {
    const success = await options.createNewItem(name, newItemDialogState.value.type);

    if (success) {
      closeNewItemDialog();
    }
  }

  function handleNewItemCancel() {
    closeNewItemDialog();
  }

  return {
    openWithState,
    newItemDialogState,
    isRenameDialogOpen,
    isNewItemDialogOpen,
    openOpenWithDialog,
    closeOpenWithDialog,
    openNewItemDialog,
    closeNewItemDialog,
    handleRenameConfirm,
    handleRenameCancel,
    handleNewItemConfirm,
    handleNewItemCancel,
  };
}
