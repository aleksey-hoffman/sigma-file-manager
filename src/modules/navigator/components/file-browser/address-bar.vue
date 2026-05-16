<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  markRaw,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import {
  TextCursorIcon,
  CopyIcon,
  ClipboardPasteIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  ChevronRightIcon,
} from '@lucide/vue';
import { toast, ToastStatic } from '@/components/ui/toaster';
import type { DirContents } from '@/types/dir-entry';
import { DirEntryInteractive } from '@/components/dir-entry-interactive';
import { registerDropContainer, unregisterDropContainer } from '@/composables/use-drop-target-registry';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import normalizePath, { getPathDisplayName, getPathSegments, isUncPath } from '@/utils/normalize-path';
import { useOpenCopiedPath } from './composables/use-open-copied-path';

const props = defineProps<{
  currentPath: string;
}>();

const emit = defineEmits<{
  navigate: [path: string];
  openFile: [path: string];
  edit: [];
}>();

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();
const { openCopiedPath } = useOpenCopiedPath({
  openDirectory: path => emit('navigate', path),
  openFile: path => emit('openFile', path),
});
const openCopiedPathShortcutLabel = computed(() => shortcutsStore.getShortcutLabel('openCopiedPath'));

const addressBarRef = ref<HTMLElement | null>(null);
const breadcrumbsContainerRef = ref<HTMLElement | null>(null);
const separatorDropdowns = ref<{ [key: number]: string[] }>({});
const openSeparatorIndex = ref<number | null>(null);

const addressParts = computed(() => {
  if (!props.currentPath) return [];

  const normalizedPath = normalizePath(props.currentPath).replace(/\/+$/, '');
  const parts = getPathSegments(normalizedPath);
  const uncPath = isUncPath(normalizedPath);
  const formattedParts: Array<{
    path: string;
    name: string;
    isLast: boolean;
  }> = [];

  parts.forEach((part, index) => {
    const pathSegments = parts.slice(0, index + 1);
    let fullPath = '';

    if (uncPath) {
      fullPath = `//${pathSegments.join('/')}`;
    }
    else if (normalizedPath.startsWith('/')) {
      fullPath = `/${pathSegments.join('/')}`;
    }
    else if (pathSegments[0]?.includes(':')) {
      fullPath = `${pathSegments[0]}/`;

      if (pathSegments.length > 1) {
        fullPath += pathSegments.slice(1).join('/');
      }
    }
    else {
      fullPath = pathSegments.join('/');
    }

    formattedParts.push({
      path: fullPath,
      name: part,
      isLast: index === parts.length - 1,
    });
  });

  return formattedParts;
});

watch(() => props.currentPath, () => {
  nextTick(() => {
    scrollBreadcrumbsToEnd();
  });
});

function scrollBreadcrumbsToEnd() {
  if (breadcrumbsContainerRef.value) {
    breadcrumbsContainerRef.value.scrollLeft = breadcrumbsContainerRef.value.scrollWidth;
  }
}

async function loadSeparatorDirectories(index: number) {
  const part = addressParts.value[index];
  if (!part) return;

  try {
    const result = await invoke<DirContents>('read_dir', { path: part.path });
    const directories = result.entries
      .filter(entry => entry.is_dir)
      .map(entry => ({
        path: entry.path,
        name: entry.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    separatorDropdowns.value[index] = directories.map(d => d.path);
  }
  catch {
    separatorDropdowns.value[index] = [];
  }
}

function handleSeparatorNavigate(path: string) {
  emit('navigate', path);
}

function handleBreadcrumbsWheel(event: WheelEvent) {
  if (breadcrumbsContainerRef.value) {
    event.preventDefault();
    breadcrumbsContainerRef.value.scrollLeft += event.deltaY;
  }
}

function navigateToPart(path: string) {
  emit('navigate', path);
}

function openEditor() {
  emit('edit');
}

async function copyPathToClipboard() {
  try {
    await navigator.clipboard.writeText(props.currentPath);
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: t('dialogs.localShareManagerDialog.addressCopiedToClipboard'),
          description: props.currentPath,
        },
      },
      duration: 2000,
    });
  }
  catch (error) {
    console.error('Failed to copy path:', error);
  }
}

let dropContainerId: number | null = null;

onMounted(() => {
  nextTick(() => {
    scrollBreadcrumbsToEnd();
  });

  dropContainerId = registerDropContainer({
    componentRef: addressBarRef,
    entriesContainerRef: addressBarRef,
    disableBackgroundDrop: true,
  });
});

onUnmounted(() => {
  if (dropContainerId !== null) {
    unregisterDropContainer(dropContainerId);
  }
});
</script>

<template>
  <div
    ref="addressBarRef"
    class="address-bar"
  >
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="address-bar__menu-button"
            >
              <EllipsisVerticalIcon :size="16" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <DropdownMenuContent
          :side="'bottom'"
          :align="'start'"
          class="address-bar__menu"
        >
          <DropdownMenuItem
            class="address-bar__menu-item-with-shortcut"
            @select="copyPathToClipboard"
          >
            <CopyIcon :size="16" />
            <span>{{ t('settings.addressBar.copyPathToClipboard') }}</span>
            <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('copyCurrentDirectoryPath') }}</ContextMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            class="address-bar__menu-item-with-shortcut"
            @select="openCopiedPath"
          >
            <ClipboardPasteIcon :size="16" />
            <span>{{ t('settings.addressBar.openCopiedPath') }}</span>
            <ContextMenuShortcut>{{ openCopiedPathShortcutLabel }}</ContextMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
        <TooltipContent>
          {{ t('settings.addressBar.addressBarActions') }}
        </TooltipContent>
      </Tooltip>
    </DropdownMenu>
    <div
      ref="breadcrumbsContainerRef"
      class="address-bar__breadcrumbs"
      data-e2e-root="address-bar-breadcrumbs"
      :data-e2e-current-path="props.currentPath ?? ''"
      @wheel="handleBreadcrumbsWheel"
      @click="openEditor"
    >
      <div class="address-bar__breadcrumbs-inner">
        <template
          v-for="(part, index) in addressParts"
          :key="index"
        >
          <DirEntryInteractive
            :path="part.path"
            :is-file="false"
            :is-current-directory-context="part.isLast"
          >
            <button
              class="address-bar__part"
              :class="{ 'address-bar__part--last': part.isLast }"
              :title="part.path"
              @click.stop="!part.isLast && navigateToPart(part.path)"
            >
              {{ part.name }}
            </button>
          </DirEntryInteractive>
          <DropdownMenu
            v-if="!part.isLast"
            @update:open="(open: boolean) => {
              if (open) {
                loadSeparatorDirectories(index);
                openSeparatorIndex = index;
              } else {
                openSeparatorIndex = null;
              }
            }"
          >
            <DropdownMenuTrigger as-child>
              <button
                class="address-bar__separator"
                :title="t('settings.addressBar.showSiblingDirectories')"
                @click.stop
              >
                <ChevronRightIcon
                  :size="12"
                  :class="{ 'address-bar__separator-icon--open': openSeparatorIndex === index }"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              :side="'bottom'"
              :align="'start'"
              class="address-bar__separator-menu"
            >
              <ScrollArea
                as-child
                class="address-bar__separator-menu-scroll"
              >
                <DropdownMenuItem
                  v-for="dirPath in separatorDropdowns[index]"
                  :key="dirPath"
                  @select="handleSeparatorNavigate(dirPath)"
                >
                  <FolderIcon
                    :size="14"
                    class="address-bar__separator-menu-icon"
                  />
                  <span class="address-bar__separator-menu-path">{{ getPathDisplayName(dirPath) || dirPath }}</span>
                </DropdownMenuItem>
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
        </template>
      </div>
    </div>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="address-bar__edit-button"
          @click="openEditor"
        >
          <TextCursorIcon :size="14" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div class="address-bar__tooltip-row">
          {{ t('settings.addressBar.editAddress') }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('toggleAddressBar') }}</ContextMenuShortcut>
        </div>
      </TooltipContent>
    </Tooltip>
  </div>
</template>

<style scoped>
.address-bar {
  position: relative;
  display: flex;
  overflow: hidden;
  min-width: 0;
  height: 36px;
  flex: 1;
  align-items: center;
  padding: 0 2px;
  border: 1px solid hsl(var(--border) / 50%);
  border-radius: var(--radius-md);
  background-color: hsl(var(--background) / 50%);
  gap: 2px;
  transition: background-color 0.15s, border-color 0.15s;
}

.address-bar:hover {
  border-color: hsl(var(--border));
  background-color: hsl(var(--muted) / 50%);
}

.address-bar__menu-button,
.address-bar__edit-button {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.address-bar__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.address-bar__breadcrumbs {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 1;
  align-items: center;
  padding: 0 2px;
  cursor: text;
  overflow-x: auto;
  scrollbar-width: none;
}

.address-bar__breadcrumbs::-webkit-scrollbar {
  display: none;
}

.address-bar__breadcrumbs-inner {
  display: flex;
  min-width: max-content;
  align-items: center;
  padding-right: 8px;
}

.address-bar__part {
  padding: 4px 6px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--muted-foreground) / 70%);
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.1s, color 0.1s;
  white-space: nowrap;
}

.address-bar__part:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}

.address-bar__part:hover:not(:disabled) {
  background-color: hsl(var(--secondary));
  color: hsl(var(--foreground));
}

.address-bar__part--last {
  color: hsl(var(--muted-foreground));
}

.address-bar__separator {
  padding: 4px 6px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--muted-foreground) / 60%);
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.1s, color 0.1s;
}

.address-bar__separator:hover {
  background-color: hsl(var(--secondary));
  color: hsl(var(--foreground));
}

.address-bar__separator:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}

.address-bar__separator-icon--open {
  transform: rotate(90deg);
}

.address-bar__separator svg {
  transition: transform 0.1s ease-in-out;
}
</style>

<style>
.address-bar__menu.sigma-ui-dropdown-menu-content {
  min-width: 200px;
}

.address-bar__menu .sigma-ui-dropdown-menu-item {
  gap: 8px;
}

.address-bar__menu-item-with-shortcut {
  display: flex;
  align-items: center;
}

.address-bar__separator-menu.sigma-ui-dropdown-menu-content {
  min-width: 180px;
  max-width: 300px;
  padding: 0;
}

.address-bar__separator-menu-scroll {
  max-height: 250px;
  padding: 4px 0;
}

.address-bar__separator-menu .sigma-ui-dropdown-menu-item {
  padding: 6px 12px;
  font-size: 12px;
  gap: 8px;
}

.address-bar__separator-menu-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.address-bar .dir-entry-interactive[data-drag-over] > .address-bar__part {
  background-color: var(--drop-target-background);
  outline: var(--drop-target-outline);
  outline-offset: var(--drop-target-outline-offset);
}
</style>
