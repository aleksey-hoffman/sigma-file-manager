<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { TagSelector } from '@/components/ui/tag-selector';
import {
  PencilIcon,
  CopyIcon,
  LinkIcon,
  FolderInputIcon,
  ClipboardPasteIcon,
  Trash2Icon,
  EyeIcon,
  PrinterIcon,
  Share2Icon,
  SquarePlusIcon,
  StarIcon,
  FolderSearchIcon,
  UnplugIcon,
  InfoIcon,
  TextCursorInputIcon,
  // FORK-MODIFICATION: 本地 ↔ 远程传输与远程权限设置。
  UploadIcon,
  DownloadIcon,
  ShieldIcon,
} from '@lucide/vue';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { usePlatformStore } from '@/stores/runtime/platform';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from './types';
import { useContextMenuItems } from './composables/use-context-menu-items';
import { useFileBrowserTags } from './composables/use-file-browser-tags';
import {
  toRef,
  computed,
  ref,
  onMounted,
  onUnmounted,
} from 'vue';
import FileBrowserNewSubmenu from './file-browser-new-submenu.vue';
import FileBrowserOpenWithSubmenu from './file-browser-open-with-submenu.vue';
import FileBrowserMoreOptionsSubmenu from './file-browser-more-options-submenu.vue';
import FileBrowserArchiveSubmenu from './file-browser-archive-submenu.vue';
import FileBrowserTerminalSubmenu from './file-browser-terminal-submenu.vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import {
  getAvailableLinkCreationOptions,
  type LinkCreationKind,
} from '@/utils/link-operations';
import { useTextDirection } from '@/composables/use-text-direction';
import { isSelectionVirtualLocation } from '@/utils/entry-action-policy';
// FORK-MODIFICATION 2026-10-20：远程「新建文件」是永久非目标（规格 §1）。
import { hasRemoteTarget } from '@/modules/remote/utils/remote-write';

const props = withDefaults(defineProps<{
  selectedEntries: DirEntry[];
  menuItemComponent: object;
  menuSeparatorComponent: object;
  disableDestructiveActions?: boolean;
  isCurrentDirectoryContext?: boolean;
  /** FORK-MODIFICATION: 供「打开所属目录」判定是否在搜索结果视图。 */
  isSearchResultsView?: boolean;
}>(), {
  disableDestructiveActions: false,
  isCurrentDirectoryContext: false,
  isSearchResultsView: false,
});

const emit = defineEmits<{
  action: [action: ContextMenuAction];
  createLink: [linkKind: LinkCreationKind];
  openCustomDialog: [];
}>();

function emitAction(action: ContextMenuAction) {
  emit('action', action);
}

function handleOpenCustomDialog() {
  emit('openCustomDialog');
}

function handleCopyClick() {
  emitAction('copy');
}

function handleCutClick() {
  emitAction('cut');
}

const { t } = useI18n();

const clipboardStore = useClipboardStore();
const platformStore = usePlatformStore();
const userStatsStore = useUserStatsStore();
const shortcutsStore = useShortcutsStore();
const selectedEntriesRef = toRef(props, 'selectedEntries');
const { inlineEndSide } = useTextDirection();

const { isActionVisible, selectionStats } = useContextMenuItems(
  selectedEntriesRef,
  {
    disableDestructiveActions: toRef(props, 'disableDestructiveActions'),
    isSearchResultsView: toRef(props, 'isSearchResultsView'),
  },
);

const allSelectedAreFavorites = computed(() => {
  return props.selectedEntries.every(entry => userStatsStore.isFavorite(entry.path));
});

const {
  availableTags,
  getEntriesSharedTagIds,
  toggleTagForEntries,
  createTagForEntries,
  renameTag,
  updateTagColor,
  setTags,
} = useFileBrowserTags();

async function handleToggleTag(tagId: string) {
  await toggleTagForEntries(props.selectedEntries, tagId);
}

async function handleCreateTag(name: string) {
  await createTagForEntries(props.selectedEntries, name);
}

async function handleRenameTag(tagId: string, name: string) {
  await renameTag(tagId, name);
}

async function handleUpdateTagColor(tagId: string, color: string) {
  await updateTagColor(tagId, color);
}

const selectedItemTagIds = computed(() => getEntriesSharedTagIds(selectedEntriesRef.value));
const linkCreationOptions = computed(() =>
  getAvailableLinkCreationOptions(props.selectedEntries, platformStore.currentPlatform),
);

const selectedDirectory = computed(() => {
  return props.selectedEntries.find(entry => entry.is_dir);
});

const hasVirtualLocationSelection = computed(() => {
  return isSelectionVirtualLocation(props.selectedEntries);
});

/**
 * FORK-MODIFICATION 2026-10-20：目标目录能不能「新建空文件」。
 *
 * 目标就是**选中的那些目录**（右键菜单的「新建」建在选中目录里），
 * 没有选中目录时菜单本身不出现（`selectionStats.hasDirectories`）。
 *
 * **远程一律不行** —— 规格 §1 的永久非目标。
 */
const canCreateFile = computed(() => {
  const targets = props.selectedEntries
    .filter(entry => entry.is_dir)
    .map(entry => entry.path);

  return !hasRemoteTarget(targets);
});

const canPasteToSelectedDirectory = computed(() => {
  if (hasVirtualLocationSelection.value || !clipboardStore.hasItems || !selectedDirectory.value) {
    return false;
  }

  return clipboardStore.canPasteTo(selectedDirectory.value.path);
});

const isShiftHeld = ref(false);

const moveToTrashLabelKey = computed(() => props.isCurrentDirectoryContext
  ? 'shortcuts.moveCurrentDirectoryToTrash'
  : 'shortcuts.moveSelectedItemsToTrash');

const deleteFromDriveLabelKey = computed(() => props.isCurrentDirectoryContext
  ? 'shortcuts.deleteCurrentDirectoryFromDrive'
  : 'shortcuts.deleteSelectedItemsFromDrive');

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Shift') {
    isShiftHeld.value = true;
  }
}

function handleKeyUp(event: KeyboardEvent) {
  if (event.key === 'Shift') {
    isShiftHeld.value = false;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
});

function handleCreateLink(linkKind: LinkCreationKind) {
  emit('createLink', linkKind);
}
</script>

<template>
  <div class="file-browser-actions-menu__quick-actions">
    <slot name="quick-actions" />
    <Tooltip
      v-if="isActionVisible('rename')"
    >
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="xs"
          @click="emitAction('rename')"
        >
          <PencilIcon :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div class="file-browser-actions-menu__tooltip-row">
          {{ t('fileBrowser.actions.rename') }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('rename') }}</ContextMenuShortcut>
        </div>
      </TooltipContent>
    </Tooltip>
    <Tooltip
      v-if="isActionVisible('batch-rename')"
    >
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="xs"
          @click="emitAction('batch-rename')"
        >
          <TextCursorInputIcon :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div class="file-browser-actions-menu__tooltip-row">
          {{ t('batchRename.menuItem') }}
        </div>
      </TooltipContent>
    </Tooltip>
    <Tooltip
      v-if="isActionVisible('copy')"
    >
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="xs"
          @click="handleCopyClick"
        >
          <CopyIcon :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="file-browser-actions-menu__tooltip">
        <div class="file-browser-actions-menu__tooltip-row">
          {{ t('fileBrowser.actions.copy') }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('copy') }}</ContextMenuShortcut>
        </div>
      </TooltipContent>
    </Tooltip>
    <Tooltip
      v-if="isActionVisible('cut')"
    >
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="xs"
          @click="handleCutClick"
        >
          <FolderInputIcon :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="file-browser-actions-menu__tooltip">
        <div class="file-browser-actions-menu__tooltip-row">
          {{ t('fileBrowser.actions.move') }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('cut') }}</ContextMenuShortcut>
        </div>
      </TooltipContent>
    </Tooltip>
    <Tooltip v-if="isActionVisible('link') && linkCreationOptions.length > 0">
      <DropdownMenu>
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="xs"
            >
              <LinkIcon :size="16" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent class="file-browser-actions-menu__tooltip">
          {{ t('fileBrowser.actions.createLink') }}
        </TooltipContent>
        <DropdownMenuContent
          align="start"
          side="bottom"
          class="file-browser-actions-menu__link-dropdown"
        >
          <DropdownMenuItem
            v-for="option in linkCreationOptions"
            :key="option.kind"
            @select="handleCreateLink(option.kind)"
          >
            <UnplugIcon
              v-if="option.kind === 'shortcut'"
              :size="14"
            />
            <LinkIcon
              v-else
              :size="14"
            />
            <span>{{ t(option.labelKey) }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Tooltip>
    <Tooltip
      v-if="canPasteToSelectedDirectory"
    >
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="xs"
          @click="emitAction('paste')"
        >
          <ClipboardPasteIcon :size="16" />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="file-browser-actions-menu__tooltip">
        <div class="file-browser-actions-menu__tooltip-row">
          {{ t('shortcuts.transferPreparedForCopying') }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('paste') }}</ContextMenuShortcut>
        </div>
      </TooltipContent>
    </Tooltip>
    <!--
      FORK-MODIFICATION 2026-10-20（用户附图）：删除入口从「悬停提示」改成
      **真正可点的下拉菜单**。

      原来这里挂的是 Tooltip：鼠标停在垃圾桶图标上时浮出「移至垃圾箱 /
      从驱动器中删除」两行字，但那只是**提示**——点不动。用户看到的就是一个
      「看得见、点不着的子菜单」，只能靠 Shift+点击垃圾桶图标去猜。

      现在换成 DropdownMenu：两个操作各占一项，各自带快捷键提示。
      Del / Shift+Del 这两个**全局快捷键**不受影响，行为不变。

      图标不再跟着 Shift 变色（ShredderIcon）：按下 Shift 也不再有
      「点下去就是永久删除」这个含义了，菜单里已经写得很清楚。
    -->
    <DropdownMenu v-if="isActionVisible('delete')">
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="xs"
          class="file-browser-actions-menu__action--danger"
        >
          <Trash2Icon :size="16" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        class="file-browser-actions-menu__delete-dropdown"
      >
        <DropdownMenuItem @select="emitAction('delete')">
          <span>{{ t(moveToTrashLabelKey) }}</span>
          <DropdownMenuShortcut>{{ shortcutsStore.getShortcutLabel('delete') }}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem @select="emitAction('delete-permanently')">
          <span>{{ t(deleteFromDriveLabelKey) }}</span>
          <DropdownMenuShortcut>{{ shortcutsStore.getShortcutLabel('deletePermanently') }}</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <!--
      FORK-MODIFICATION 2026-10-20：远程条目的删除入口。

      远程**没有回收箱**，所以只有「删除」一个动作，不做下拉 ——
      摆一个「移至垃圾箱」在远程是假选项（远程删除根本不走本地回收站）。

      权限不够时**不隐藏**：能不能删取决于服务器上那个账户属于
      owner/group/other 哪一组，前端判不准；判错的后果是「能删的菜单被置灰」。
      所以一律显示，点了没权限由后端如实报错。
    -->
    <Button
      v-if="isActionVisible('remote-delete')"
      variant="ghost"
      size="xs"
      class="file-browser-actions-menu__action--danger"
      :title="t('remote.delete.menuItem')"
      @click="emitAction('remote-delete')"
    >
      <Trash2Icon :size="16" />
    </Button>
  </div>
  <component :is="menuSeparatorComponent" />
  <FileBrowserOpenWithSubmenu
    v-if="isActionVisible('open-with')"
    :selected-entries="selectedEntries"
    @open-custom-dialog="handleOpenCustomDialog"
  />
  <FileBrowserMoreOptionsSubmenu
    v-if="!hasVirtualLocationSelection"
    :selected-entries="selectedEntries"
  />
  <FileBrowserTerminalSubmenu
    v-if="!hasVirtualLocationSelection"
    :selected-entries="selectedEntries"
    :is-shift-held="isShiftHeld"
  />
  <FileBrowserArchiveSubmenu
    v-if="!hasVirtualLocationSelection"
    :selected-entries="selectedEntries"
  />
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('quick-view')"
    class="file-browser-actions-menu__item-with-shortcut"
    @select="emitAction('quick-view')"
  >
    <EyeIcon :size="16" />
    <span>{{ t('fileBrowser.actions.quickView') }}</span>
    <ContextMenuShortcut v-if="shortcutsStore.getShortcutLabel('quickView')">
      {{ shortcutsStore.getShortcutLabel('quickView') }}
    </ContextMenuShortcut>
  </component>
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('print')"
    class="file-browser-actions-menu__item-with-shortcut"
    @select="emitAction('print')"
  >
    <PrinterIcon :size="16" />
    <span>{{ t('fileBrowser.actions.print') }}</span>
    <ContextMenuShortcut v-if="shortcutsStore.getShortcutLabel('print')">
      {{ shortcutsStore.getShortcutLabel('print') }}
    </ContextMenuShortcut>
  </component>
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('open-in-new-tab')"
    @select="emitAction('open-in-new-tab')"
  >
    <SquarePlusIcon :size="16" />
    <span>{{ t('fileBrowser.actions.openInNewTab') }}</span>
  </component>
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('open-containing-directory-in-app')"
    @select="emitAction('open-containing-directory-in-app')"
  >
    <FolderSearchIcon :size="16" />
    <span>{{ t('fileBrowser.actions.openContainingDirectoryInApp') }}</span>
  </component>
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('disconnect')"
    @select="emitAction('disconnect')"
  >
    <UnplugIcon :size="16" />
    <span>{{ t('disconnect') }}</span>
  </component>
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('copy-path')"
    @select="emitAction('copy-path')"
  >
    <CopyIcon :size="16" />
    <span>{{ t('settings.addressBar.copyPathToClipboard') }}</span>
  </component>
  <!-- FORK-MODIFICATION: 本地 ↔ 远程传输。三个动作的前提都是「对面还有一格」，
       所以可见性判定不在 `CONTEXT_MENU_ITEMS` 那张表里，见
       `src/modules/remote/utils/remote-context-menu-visibility.ts`。 -->
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('upload-to-remote')"
    @select="emitAction('upload-to-remote')"
  >
    <UploadIcon :size="16" />
    <span>{{ t('remote.transfer.uploadToRemote') }}</span>
  </component>
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('download-to-local')"
    @select="emitAction('download-to-local')"
  >
    <DownloadIcon :size="16" />
    <span>{{ t('remote.transfer.downloadToLocal') }}</span>
  </component>
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('remote-permissions')"
    @select="emitAction('remote-permissions')"
  >
    <ShieldIcon :size="16" />
    <span>{{ t('remote.permissions.menuItem') }}</span>
  </component>
  <!-- FORK-MODIFICATION 2026-10-20：远程删除。菜单项**始终保留**，
       权限不足时点下去由后端报错（用户原话：「可以设置为灰色，但要保留菜单」）。 -->
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('remote-delete')"
    @select="emitAction('remote-delete')"
  >
    <Trash2Icon :size="16" />
    <span>{{ t('remote.delete.menuItem') }}</span>
  </component>
  <FileBrowserNewSubmenu
    v-if="selectionStats.hasDirectories && !hasVirtualLocationSelection"
    :can-create-file="canCreateFile"
    @action="emitAction"
  />
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('share')"
    @select="emitAction('share')"
  >
    <Share2Icon :size="16" />
    <span>{{ t('fileBrowser.actions.share') }}</span>
  </component>
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('properties')"
    class="file-browser-actions-menu__item-with-shortcut"
    @select="emitAction('properties')"
  >
    <InfoIcon :size="16" />
    <span>{{ t('fileBrowser.actions.properties') }}</span>
    <ContextMenuShortcut v-if="shortcutsStore.getShortcutLabel('properties')">
      {{ shortcutsStore.getShortcutLabel('properties') }}
    </ContextMenuShortcut>
  </component>
  <component :is="menuSeparatorComponent" />
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('toggle-favorite')"
    @select="emitAction('toggle-favorite')"
  >
    <StarIcon
      :size="16"
      :fill="allSelectedAreFavorites ? 'currentColor' : 'none'"
    />
    <span>{{ allSelectedAreFavorites ? t('fileBrowser.actions.removeFromFavorites') : t('fileBrowser.actions.addToFavorites') }}</span>
  </component>
  <div
    v-if="isActionVisible('edit-tags')"
    class="file-browser-actions-menu__tag-selector"
  >
    <TagSelector
      :tags="availableTags"
      :selected-tag-ids="selectedItemTagIds"
      :allow-create="true"
      :full-width="true"
      trigger-variant="default"
      align="end"
      :side="inlineEndSide"
      :align-offset="-16"
      :side-offset="16"
      @toggle-tag="handleToggleTag"
      @create-tag="handleCreateTag"
      @rename-tag="handleRenameTag"
      @update-tag-color="handleUpdateTagColor"
      @reorder-tags="setTags"
    />
  </div>
</template>

<style>
.file-browser-actions-menu__quick-actions {
  display: flex;
  justify-content: flex-start;
  gap: 4px;
}

.file-browser-actions-menu__link-dropdown {
  min-width: 160px;
}

/* FORK-MODIFICATION 2026-10-20：删除下拉。宽度要容得下
   「从驱动器中删除」+ 快捷键提示两列，否则文字会被挤到换行。 */
.file-browser-actions-menu__delete-dropdown {
  min-width: 220px;
}

.file-browser-actions-menu__delete-dropdown .sigma-ui-dropdown-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-browser-actions-menu__action--danger:hover {
  color: hsl(var(--destructive));
}

.file-browser-actions-menu__tooltip {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-browser-actions-menu__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.file-browser-actions-menu__tag-selector {
  padding: 6px 0;
}

.file-browser-actions-menu__item-with-shortcut {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
