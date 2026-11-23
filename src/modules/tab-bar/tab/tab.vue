<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTimeoutFn, useEventListener } from '@vueuse/core';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { Tab } from '@/types/workspaces';
import type { Component } from 'vue';
import {
  CopyPlusIcon,
  FolderIcon,
  HardDriveIcon,
  Layers,
  SearchIcon,
  XIcon,
  XLineTopIcon,
} from '@lucide/vue';
import {
  canonicalizePath,
  getPathDisplayName,
  getPathDisplayValue,
  isUnixFilesystemRoot,
  isWindowsDriveRootPath,
} from '@/utils/normalize-path';
import { getIconComponent, type UserDirectory } from '@/modules/home/composables/use-user-directories';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { useFileBrowserDragSession } from '@/modules/navigator/components/file-browser/composables/use-file-browser-drag-session';

interface Props {
  tabGroup: Tab[];
  previewEnabled: boolean;
  userDirectories: UserDirectory[];
}

interface Emits {
  (event: 'close-tab', value: Tab[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  tabGroup: () => ([]),
});

const emit = defineEmits<Emits>();

const { t } = useI18n();
const workspacesStore = useWorkspacesStore();
const shortcutsStore = useShortcutsStore();
const userSettingsStore = useUserSettingsStore();
const dragSession = useFileBrowserDragSession();
const activeFileBrowserDragState = dragSession.dragState;

const showTabPreview = true;
const NAVIGATOR_TAB_WIDTH = 124;
const LONG_PRESS_DELAY = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;
const TAB_DRAG_HOVER_OPEN_DELAY = 500;

const tabRef = ref<HTMLElement | null>(null);
const isDropdownOpen = ref(false);
const isLongPressing = ref(false);
const isPressing = ref(false);
const isDragOver = ref(false);
const startPosition = ref({
  x: 0,
  y: 0,
});

const { start: startLongPressTimer, stop: stopLongPressTimer } = useTimeoutFn(() => {
  isLongPressing.value = true;
  isDropdownOpen.value = true;
}, LONG_PRESS_DELAY, { immediate: false });

useEventListener(document, 'pointermove', (event: PointerEvent) => {
  if (!isPressing.value) return;

  const deltaX = Math.abs(event.clientX - startPosition.value.x);
  const deltaY = Math.abs(event.clientY - startPosition.value.y);
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  if (distance > LONG_PRESS_MOVE_THRESHOLD) {
    stopLongPressTimer();
  }
});

useEventListener(document, 'pointerup', () => {
  isPressing.value = false;
  stopLongPressTimer();
});

useEventListener(document, 'pointercancel', () => {
  isPressing.value = false;
  stopLongPressTimer();
});

function handlePointerDown(event: PointerEvent) {
  if (event.pointerType !== 'touch') return;

  isPressing.value = true;
  startPosition.value = {
    x: event.clientX,
    y: event.clientY,
  };
  startLongPressTimer();
}

const isActive = computed(() => (
  props.tabGroup?.[0]?.id === workspacesStore.currentTabGroup?.[0]?.id
));

const canCloseAllDuplicateTabs = computed(() => workspacesStore.hasDuplicatePathTabs);
const dropTargetTab = computed(() => props.tabGroup.find(tab => tab.type === 'directory'));
const isFileBrowserDragActive = computed(() => activeFileBrowserDragState.value.isActive);
const isTabPreviewDisabled = computed(() =>
  !(props.previewEnabled && showTabPreview) || isDropdownOpen.value || isFileBrowserDragActive.value,
);
const canDropOnTab = computed(() => isFileBrowserDragActive.value && !!dropTargetTab.value?.path);

const { start: startDragHoverOpenTimer, stop: stopDragHoverOpenTimer } = useTimeoutFn(() => {
  if (!isFileBrowserDragActive.value || isActive.value || props.tabGroup.length === 0) {
    return;
  }

  workspacesStore.openTabGroup(props.tabGroup);
}, TAB_DRAG_HOVER_OPEN_DELAY, { immediate: false });

function getTabDisplayName(tab: Tab | undefined): string {
  if (!tab) {
    return '';
  }

  return getPathDisplayName(tab.path, t) || getPathDisplayName(tab.name, t) || tab.name || tab.path;
}

function getTabIcon(tab: Tab): Component {
  if (tab.type === 'search') {
    return SearchIcon;
  }

  if (isWindowsDriveRootPath(tab.path) || isUnixFilesystemRoot(tab.path)) {
    return HardDriveIcon;
  }

  const tabPath = canonicalizePath(tab.path);
  const userDirectory = props.userDirectories.find(directory => canonicalizePath(directory.path) === tabPath);

  return userDirectory ? getIconComponent(userDirectory.iconName) : FolderIcon;
}

const tabIcons = computed(() => props.tabGroup.map(getTabIcon));

function tabOnClick(tabGroup: Tab[]) {
  if (isLongPressing.value) {
    isLongPressing.value = false;
    return;
  }

  workspacesStore.openTabGroup(tabGroup);
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault();
  isDropdownOpen.value = true;
}

function handleTabMouseDown(event: MouseEvent) {
  if (event.button === 1) {
    event.preventDefault();
    event.stopPropagation();
    emit('close-tab', props.tabGroup);
  }
}

function handleTabMouseEnter() {
  if (!isFileBrowserDragActive.value || props.tabGroup.length === 0) {
    return;
  }

  isDragOver.value = canDropOnTab.value;

  if (isActive.value) {
    return;
  }

  startDragHoverOpenTimer();
}

function handleTabMouseLeave() {
  isDragOver.value = false;
  stopDragHoverOpenTimer();
}

function handleTabMouseUp(event: MouseEvent) {
  if (!canDropOnTab.value || !dropTargetTab.value?.path) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  isDragOver.value = false;
  stopDragHoverOpenTimer();
  dragSession.dropOn(dropTargetTab.value.path, event.shiftKey ? 'copy' : undefined);
}

async function duplicateTab() {
  const path = props.tabGroup[0]?.path;

  if (!path) {
    return;
  }

  await workspacesStore.openNewTabGroup(path);
}

function closeOtherTabs() {
  workspacesStore.closeOtherTabGroups(props.tabGroup);
}

function closeAllDuplicateTabs() {
  if (canCloseAllDuplicateTabs.value) {
    workspacesStore.closeAllDuplicatePathTabs();
  }
}

function closeAllTabs() {
  workspacesStore.closeAllTabGroups();
}

onBeforeUnmount(() => {
  isDragOver.value = false;
  stopDragHoverOpenTimer();
});
</script>

<template>
  <DropdownMenu
    v-model:open="isDropdownOpen"
  >
    <Tooltip
      :disabled="isTabPreviewDisabled"
      :key="isTabPreviewDisabled ? 'disabled' : 'enabled'"
    >
      <TooltipTrigger as-child>
        <DropdownMenuTrigger
          as-child
          :disabled="true"
        >
          <div
            v-if="tabGroup.length"
            ref="tabRef"
            v-wave
            class="tab"
            :class="{ 'tab--active-title-bold': userSettingsStore.userSettings.navigator.boldActiveTabTitle }"
            :style="{
              '--tab-width': `${props.tabGroup.length === 2 ? NAVIGATOR_TAB_WIDTH * 2 : NAVIGATOR_TAB_WIDTH}px`
            }"
            :is-active="isActive"
            :data-drag-over="isDragOver || undefined"
            @click.stop="tabOnClick(props.tabGroup)"
            @mousedown="handleTabMouseDown"
            @mouseup="handleTabMouseUp"
            @contextmenu="handleContextMenu"
            @pointerdown="handlePointerDown"
            @mouseenter="handleTabMouseEnter"
            @mouseleave="handleTabMouseLeave"
          >
            <template
              v-for="(tab, index) in props.tabGroup"
              :key="tab.id"
            >
              <span
                v-if="index > 0"
                class="tab__divider"
              />
              <div class="tab__segment">
                <component
                  :is="tabIcons[index]"
                  :size="14"
                  class="tab__icon"
                />
                <span class="tab__title">
                  {{ getTabDisplayName(tab) }}
                </span>
              </div>
            </template>

            <button
              class="tab__close-button"
              x-small
              icon
              @click.stop="emit('close-tab', props.tabGroup)"
            >
              <XIcon :size="14" />
            </button>
          </div>
        </DropdownMenuTrigger>
      </TooltipTrigger>
      <DropdownMenuContent
        align="start"
        class="tab__dropdown-menu"
      >
        <DropdownMenuItem
          class="tab__menu-item-with-shortcut"
          @select="duplicateTab"
        >
          <CopyPlusIcon
            class="tab__menu-button-icon"
            :size="14"
          />
          {{ t('tabs.duplicateTab') }}
          <DropdownMenuShortcut v-if="shortcutsStore.getShortcutLabel('duplicateCurrentTab')">
            {{ shortcutsStore.getShortcutLabel('duplicateCurrentTab') }}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem @select="closeOtherTabs">
          <XLineTopIcon
            class="tab__menu-button-icon"
            :size="14"
          />
          {{ t('tabs.closeOtherTabs') }}
        </DropdownMenuItem>
        <DropdownMenuItem @select="closeAllTabs">
          <XIcon
            class="tab__menu-button-icon"
            :size="14"
          />
          {{ t('tabs.closeAllTabs') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          :disabled="!canCloseAllDuplicateTabs"
          @select="closeAllDuplicateTabs"
        >
          <Layers
            class="tab__menu-button-icon"
            :size="14"
          />
          {{ t('tabs.closeDuplicateTabs') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <TooltipContent
        side="bottom"
        class="tab__tooltip-content"
      >
        <span>
          <div
            v-for="(tab, index) in props.tabGroup"
            :key="index"
          >
            <div class="tab__tooltip-title">
              {{ getTabDisplayName(tab) }}
            </div>
            <div class="tab__tooltip-subtitle">
              {{ getPathDisplayValue(tab.path) }}
            </div>
          </div>
        </span>
      </TooltipContent>
    </Tooltip>
  </DropdownMenu>
</template>

<style>
.tab {
  position: relative;
  display: flex;
  overflow: hidden;
  width: var(--tab-width);
  min-width: 0;
  height: var(--tab-segment-height);
  align-items: center;
  padding: 0 28px 0 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  -webkit-app-region: no-drag;
  background-color: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  gap: 8px;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  user-select: none;

  --tab-accent: color-mix(in oklch, hsl(var(--primary)), white 35%);
}

.tab:hover {
  background-color: hsl(var(--foreground) / 5%);
}

.tab[is-active="true"] {
  border-color: hsl(var(--primary) / 55%);
  background-color: hsl(var(--primary) / 16%);
  color: hsl(var(--foreground) / 90%);
}

.tab[is-active="true"]::after {
  position: absolute;
  top: 50%;
  left: 3px;
  width: 2px;
  height: 10px;
  border-radius: 1px;
  margin-top: -5px;
  background-color: var(--tab-accent);
  content: "";
}

.tab[is-active="true"] .tab__icon {
  color: var(--tab-accent);
}

.tab[is-active="true"].tab--active-title-bold .tab__title {
  font-weight: 700;
}

.tab[data-drag-over] {
  background-color: var(--drop-target-background);
  outline: var(--drop-target-outline);
  outline-offset: var(--drop-target-outline-offset);
}

.tab__segment {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
}

.tab__icon {
  flex-shrink: 0;
  opacity: 0.9;
}

.tab__divider {
  --tab-divider-color: hsl(var(--foreground) / 38%);

  position: relative;
  width: 11px;
  flex-shrink: 0;
  align-self: stretch;
  margin: 1px 0;
  background:
    linear-gradient(
      to bottom,
      transparent,
      var(--tab-divider-color) 15%,
      var(--tab-divider-color) 32%,
      transparent 32%,
      transparent 68%,
      var(--tab-divider-color) 68%,
      var(--tab-divider-color) 85%,
      transparent
    )
    center / 1px 100% no-repeat;
}

.tab__divider::before,
.tab__divider::after {
  position: absolute;
  top: 50%;
  left: 50%;
  content: "";
  transform: translate(-50%, -50%) rotate(45deg);
}

.tab__divider::before {
  width: 7px;
  height: 7px;
  border: 1px solid var(--tab-divider-color);
}

.tab__divider::after {
  width: 3px;
  height: 3px;
  background-color: var(--tab-divider-color);
}

.tab[is-active="true"] .tab__divider {
  --tab-divider-color: var(--tab-accent);
}

.tab__title {
  overflow: hidden;
  min-width: 0;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab__close-button {
  position: absolute;
  right: 3px;
  display: flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  opacity: 0.5;
}

.tab:hover .tab__close-button,
.tab[is-active="true"] .tab__close-button {
  opacity: 0.9;
}

.tab__close-button:focus-visible {
  opacity: 1;
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}

.tab__close-button:hover {
  background-color: hsl(var(--primary) / 20%);
}

.tab__tooltip-title {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab__tooltip-subtitle {
  overflow: hidden;
  color: hsl(var(--foreground) / 50%);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab__tooltip-content {
  min-width: 200px;
  max-width: 400px;
}

.tab__dropdown-menu {
  min-width: 220px;
}

.tab__menu-item-with-shortcut {
  gap: 8px;
}

.tab__menu-button {
  color: hsl(var(--muted-foreground));
}

.tab__menu-button-icon {
  margin-right: 8px;
}
</style>
