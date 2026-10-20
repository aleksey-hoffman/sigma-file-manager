<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ContextMenuSub } from 'reka-ui';
import {
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuItem,
} from '@/components/ui/context-menu';
import { FilePlusIcon, FolderPlusIcon, PlusIcon } from '@lucide/vue';
import type { ContextMenuAction } from './types';

const props = withDefaults(defineProps<{
  /**
   * FORK-MODIFICATION 2026-10-20：目标目录能不能「新建空文件」。
   *
   * **远程永远为 false** —— 规格 §1 把「在远程目录里新建空文件」列为
   * **永久非目标**（SFTP 没有 `CREATE`，FTP 的 `STOR` 需要先有本地文件）。
   *
   * 这里的隐藏是**第一道**防线；第二道在 `createNewItem` 里 ——
   * 快捷键与命令面板绕过了所有菜单。
   */
  canCreateFile?: boolean;
}>(), {
  canCreateFile: true,
});

const emit = defineEmits<{
  action: [action: ContextMenuAction];
}>();

const { t } = useI18n();

function handleCreateFile() {
  emit('action', 'create-file');
}

function handleCreateDirectory() {
  emit('action', 'create-directory');
}
</script>

<template>
  <ContextMenuSub>
    <ContextMenuSubTrigger class="file-browser-new-submenu__trigger">
      <PlusIcon :size="16" />
      <span>{{ t('new') }}</span>
    </ContextMenuSubTrigger>
    <ContextMenuSubContent class="file-browser-new-submenu">
      <ContextMenuItem @select="handleCreateDirectory">
        <FolderPlusIcon :size="14" />
        {{ t('navigator.newDirectory') }}
      </ContextMenuItem>
      <ContextMenuItem
        v-if="props.canCreateFile"
        @select="handleCreateFile"
      >
        <FilePlusIcon :size="14" />
        {{ t('navigator.newFile') }}
      </ContextMenuItem>
    </ContextMenuSubContent>
  </ContextMenuSub>
</template>

<style>
.file-browser-new-submenu {
  min-width: 180px;
}

.file-browser-new-submenu__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
