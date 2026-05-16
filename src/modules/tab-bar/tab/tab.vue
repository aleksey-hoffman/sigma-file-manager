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
import { Layers, XIcon, XLineTopIcon } from '@lucide/vue';
import { getPathDisplayName, getPathDisplayValue } from '@/utils/normalize-path';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFileBrowserDragSession } from '@/modules/navigator/components/file-browser/composables/use-file-browser-drag-session';

interface Props {
  tabGroup: Tab[];
  previewEnabled: boolean;
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
const userSettingsStore = useUserSettingsStore();
const dragSession = useFileBrowserDragSession();
const activeFileBrowserDragState = dragSession.dragState;

const showTabPreview = true;
const NAVIGATOR_TAB_WIDTH = 100;
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
  props.tabGroup?.[0]?.id === workspacesStore.currentTab?.id
));

const canCloseDuplicateTabs = computed(() => props.tabGroup.length === 1);
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

  return getPathDisplayName(tab.name) || getPathDisplayName(tab.path) || tab.name || tab.path;
}

const tabName = computed(() => {
  const firstTab = props.tabGroup?.[0];
  const secondTab = props.tabGroup?.[1];

  if (props.tabGroup?.length === 2 && secondTab) {
    return `${getTabDisplayName(firstTab)} | ${getTabDisplayName(secondTab)}`;
  }

  return getTabDisplayName(firstTab);
});

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

function closeOtherTabs() {
  workspacesStore.closeOtherTabGroups(props.tabGroup);
}

function closeDuplicateTabs() {
  const keepTab = props.tabGroup[0];

  if (canCloseDuplicateTabs.value && keepTab) {
    workspacesStore.closeDuplicatePathTabs(keepTab.id);
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
            <div class="tab__title">
              <span>
                {{ tabName }}
              </span>
            </div>

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
          :disabled="!canCloseDuplicateTabs"
          @select="closeDuplicateTabs"
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
  width: var(--tab-width, 100px);
  min-width: 0;
  height: var(--tab-height);
  align-items: center;
  padding: 0 10px;
  padding-right: 4px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  -webkit-app-region: no-drag;
  background-color: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  opacity: 0.9;
  user-select: none;
}

.tab[is-active="true"] {
  background-color: hsl(var(--background-2));
  color: hsl(var(--foreground) / 80%);
  opacity: 1;
}

.tab[is-active="true"].tab--active-title-bold .tab__title {
  font-weight: 700;
}

.tab::after {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 92%;
  height: 1px;
  background-color: hsl(var(--background-2) / 0%);
  box-shadow: 0 0 6px hsl(var(--background-2) / 0%);
  content: "";
  transform: translateX(-50%);
}

.tab[is-active="true"]::after {
  background-color: hsl(var(--primary) / 40%);
  box-shadow: 0 0 8px hsl(var(--primary) / 90%);
}

.tab:hover {
  background-color: hsl(var(--background-2) / 70%)
}

.tab[data-drag-over] {
  background-color: var(--drop-target-background);
  outline: var(--drop-target-outline);
  outline-offset: var(--drop-target-outline-offset);
}

.tab__title {
  overflow: hidden;
  width: calc(100% - 24px);
  font-size: 12px;
  text-overflow: clip;
  white-space: nowrap;
}

.tab__close-button {
  position: absolute;
  right: 3px;
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
}

.tab__close-button:focus-visible {
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
  min-width: 160px;
}

.tab__menu-button {
  color: hsl(var(--muted-foreground));
}

.tab__menu-button-icon {
  margin-right: 8px;
}
</style>
