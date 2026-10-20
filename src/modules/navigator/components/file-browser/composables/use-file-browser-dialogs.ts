// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, markRaw, ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DirEntry } from '@/types/dir-entry';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { canCreateItemIn } from '@/modules/remote/utils/remote-write';

type RenameState = {
  isActive: boolean;
  entry: DirEntry | null;
};

export function useFileBrowserDialogs(options: {
  renameState: Ref<RenameState>;
  cancelRename: () => void;
  confirmRename: (newName: string) => Promise<boolean>;
  createNewItem: (name: string, itemType: 'directory' | 'file', targetPaths?: string[]) => Promise<boolean>;
  /** 当前这一格所在的目录。用于判断「新建」的目标是不是远程。 */
  currentPath: Ref<string>;
}) {
  const { t } = useI18n();

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

  /**
   * 打开「新建」对话框。
   *
   * FORK-MODIFICATION 2026-10-20：远程「新建空文件」是**永久非目标**（规格 §1）。
   *
   * 入口已经在菜单/工具栏层面藏起来了，但**快捷键与命令面板绕过了所有菜单** ——
   * 真机验收就是这么撞上的：远程格按 Ctrl+Shift+M 照样弹出一个
   * 注定失败的「新建文件」对话框，用户填完名字点「创建」才看到错误提示。
   *
   * 所以这里再挡一道：当场给一句提示，不要先弹框。
   * 这条守卫是**唯一**能拦住所有入口的地方（菜单、工具栏、快捷键、命令面板
   * 全都从这里进），所以产品规则也写在这里。
   */
  function openNewItemDialog(type: 'directory' | 'file', targetPaths?: string[]) {
    const directoryPaths = targetPaths && targetPaths.length > 0
      ? targetPaths
      : [options.currentPath.value];

    if (!canCreateItemIn(type, directoryPaths)) {
      notifyFileCreationNotSupported();
      return;
    }

    newItemDialogState.value = {
      isOpen: true,
      type,
      targetPaths,
    };
  }

  function notifyFileCreationNotSupported() {
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: t('remote.write.fileCreationNotSupportedTitle'),
          description: t('remote.write.fileCreationNotSupported'),
        },
      },
    });
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
