<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

FORK-MODIFICATION: 目录树右键菜单。
  原始范围(2026-10-12 §5.4):copy-path / paste / open-containing-directory / properties
  验收反馈 2026-10-13 调整:把"复制文件路径"换成真"复制"(entry 进剪贴板),
  改"将准备复制/移动的项目传输到此处"为"粘贴",新增"剪切"、"重命名"。

  最终菜单项(6):
    1. 复制          (copy)            → setClipboard('copy', [entry], ...)
    2. 剪切          (cut)             → setClipboard('move', [entry], ...)
    3. 粘贴          (paste, 条件)     → 已支持
    4. 重命名        (rename)          → 弹 FileBrowserRenameDialog
    5. 属性          (properties)      → 已支持
    6. 打开文件所在目录(open-containing-directory, 仅 file) → 已支持
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
import {
  CopyIcon, ScissorsIcon, ClipboardPasteIcon, InfoIcon, FolderOpenIcon, PencilIcon,
} from '@lucide/vue';
import type { DirEntry } from '@/types/dir-entry';

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

// 「粘贴」仅当:节点是目录 + 剪贴板有内容 + 可粘贴到此目录
const canPaste = computed(() => (
  props.target.isDirectory
  && clipboardStore.hasItems
  && clipboardStore.canPasteTo(props.target.path)
));

// 「打开文件所在目录」仅 file 节点可见(directory 上无意义)
const showOpenContainingDirectory = computed(() => !props.target.isDirectory);

// 把 TreeMenuTarget 构造成最小 DirEntry 喂给 clipboardStore.setClipboard。
// properties / rename / copy / cut 都会复用这同一份。
function buildEntry(): DirEntry {
  const path = props.target.path;
  const name = path.split(/[\\/]/).pop() ?? '';
  return {
    name,
    path,
    ext: '',
    is_dir: props.target.isDirectory,
    is_file: !props.target.isDirectory,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    item_count: null,
    mime: null,
  } as unknown as DirEntry;
}

function handleCopy() {
  clipboardStore.setClipboard('copy', [buildEntry()], 'tree-context-menu');
  emitAction('copy');
}

function handleCut() {
  clipboardStore.setClipboard('move', [buildEntry()], 'tree-context-menu');
  emitAction('cut');
}

function emitAction(name: string) {
  emit('action', name);
  emit('close');
}
</script>

<template>
  <ContextMenuContent>
    <ContextMenuItem data-test="ctx-tree-copy" @select="handleCopy">
      <CopyIcon :size="14" />
      <span>{{ t('fileBrowser.actions.copy') }}</span>
    </ContextMenuItem>
    <ContextMenuItem data-test="ctx-tree-cut" @select="handleCut">
      <ScissorsIcon :size="14" />
      <span>{{ t('fileBrowser.actions.cut') }}</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="canPaste"
      data-test="ctx-tree-paste"
      @select="emitAction('paste')"
    >
      <ClipboardPasteIcon :size="14" />
      <span>{{ t('fileBrowser.actions.paste') }}</span>
    </ContextMenuItem>
    <ContextMenuSeparator v-if="canPaste" />
    <ContextMenuItem data-test="ctx-tree-rename" @select="emitAction('rename')">
      <PencilIcon :size="14" />
      <span>{{ t('fileBrowser.actions.rename') }}</span>
    </ContextMenuItem>
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
