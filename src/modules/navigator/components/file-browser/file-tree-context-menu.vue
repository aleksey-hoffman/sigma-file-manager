<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

FORK-MODIFICATION: 目录树右键菜单（C 范围：复制路径 / 粘贴 / 属性 / 打开文件所在目录）。
详见 docs/superpowers/specs/2026-10-12-navigator-polish-pack-design.md §5.4。
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { CopyIcon, ClipboardPasteIcon, InfoIcon, FolderOpenIcon } from '@lucide/vue';

// 父级只传两个字段：路径 + 是否目录。详见 spec §5.4。
export interface TreeMenuTarget {
  path: string;
  isDirectory: boolean;
}

const props = defineProps<{
  target: TreeMenuTarget;
}>();

const emit = defineEmits<{
  action: [name: string];
  close: [];
}>();

const { t } = useI18n();
const clipboardStore = useClipboardStore();

// 「粘贴」仅当：节点是目录 + 剪贴板有内容 + 可粘贴到此目录
const canPaste = computed(() => (
  props.target.isDirectory
  && clipboardStore.hasItems
  && clipboardStore.canPasteTo(props.target.path)
));

// 「打开文件所在目录」仅 file 节点可见（directory 上无意义）
const showOpenContainingDirectory = computed(() => !props.target.isDirectory);

function emitAction(name: string) {
  emit('action', name);
  emit('close');
}
</script>

<template>
  <ContextMenuContent>
    <ContextMenuItem data-test="ctx-tree-copy-path" @select="emitAction('copy-path')">
      <CopyIcon :size="14" />
      <span>{{ t('settings.addressBar.copyPathToClipboard') }}</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="canPaste"
      data-test="ctx-tree-paste"
      @select="emitAction('paste')"
    >
      <ClipboardPasteIcon :size="14" />
      <span>{{ t('shortcuts.transferPreparedForCopying') }}</span>
    </ContextMenuItem>
    <ContextMenuSeparator v-if="canPaste" />
    <ContextMenuItem
      v-if="showOpenContainingDirectory"
      data-test="ctx-tree-open-containing-directory"
      @select="emitAction('open-containing-directory')"
    >
      <FolderOpenIcon :size="14" />
      <span>{{ t('fileBrowser.actions.openContainingDirectory') }}</span>
    </ContextMenuItem>
    <ContextMenuItem data-test="ctx-tree-properties" @select="emitAction('properties')">
      <InfoIcon :size="14" />
      <span>{{ t('fileBrowser.actions.properties') }}</span>
    </ContextMenuItem>
  </ContextMenuContent>
</template>