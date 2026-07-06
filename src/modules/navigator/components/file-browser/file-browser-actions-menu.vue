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
  ShredderIcon,
  EyeIcon,
  PrinterIcon,
  Share2Icon,
  SquarePlusIcon,
  StarIcon,
  UnplugIcon,
  InfoIcon,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import {
  getAvailableLinkCreationOptions,
  type LinkCreationKind,
} from '@/utils/link-operations';
import { useTextDirection } from '@/composables/use-text-direction';
import { isSelectionVirtualLocation } from '@/utils/entry-action-policy';

const props = withDefaults(defineProps<{
  selectedEntries: DirEntry[];
  menuItemComponent: object;
  menuSeparatorComponent: object;
  disableDestructiveActions?: boolean;
  isCurrentDirectoryContext?: boolean;
}>(), {
  disableDestructiveActions: false,
  isCurrentDirectoryContext: false,
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
  { disableDestructiveActions: toRef(props, 'disableDestructiveActions') },
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

const canPasteToSelectedDirectory = computed(() => {
  if (hasVirtualLocationSelection.value || !clipboardStore.hasItems || !selectedDirectory.value) {
    return false;
  }

  return clipboardStore.canPasteTo(selectedDirectory.value.path);
});

const isShiftHeld = ref(false);

const trashTooltipKey = computed(() => props.isCurrentDirectoryContext
  ? 'shortcuts.moveCurrentDirectoryToTrash'
  : 'shortcuts.moveSelectedItemsToTrash');

const deleteTooltipKey = computed(() => props.isCurrentDirectoryContext
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

function handleDeleteClick() {
  emitAction(isShiftHeld.value ? 'delete-permanently' : 'delete');
}

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
    <Tooltip
      v-if="isActionVisible('delete')"
    >
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="xs"
          class="file-browser-actions-menu__action--danger"
          @click="handleDeleteClick"
        >
          <ShredderIcon
            v-if="isShiftHeld"
            :size="16"
          />
          <Trash2Icon
            v-else
            :size="16"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent class="file-browser-actions-menu__tooltip">
        <div class="file-browser-actions-menu__tooltip-row">
          {{ t(trashTooltipKey) }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('delete') }}</ContextMenuShortcut>
        </div>
        <div class="file-browser-actions-menu__tooltip-row">
          {{ t(deleteTooltipKey) }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('deletePermanently') }}</ContextMenuShortcut>
        </div>
      </TooltipContent>
    </Tooltip>
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
    class="file-browser-actions-menu__item-with-shortcut"
    @select="emitAction('open-in-new-tab')"
  >
    <SquarePlusIcon :size="16" />
    <span>{{ t('fileBrowser.actions.openInNewTab') }}</span>
    <ContextMenuShortcut v-if="shortcutsStore.getShortcutLabel('openNewTab')">
      {{ shortcutsStore.getShortcutLabel('openNewTab') }}
    </ContextMenuShortcut>
  </component>
  <component
    :is="menuItemComponent"
    v-if="isActionVisible('copy-path')"
    @select="emitAction('copy-path')"
  >
    <CopyIcon :size="16" />
    <span>{{ t('settings.addressBar.copyPathToClipboard') }}</span>
  </component>
  <FileBrowserNewSubmenu
    v-if="selectionStats.hasDirectories && !hasVirtualLocationSelection"
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
      :max-badges="1"
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
