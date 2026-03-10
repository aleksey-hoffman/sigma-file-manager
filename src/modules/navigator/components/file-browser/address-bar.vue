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
import { dirname } from '@tauri-apps/api/path';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { onClickOutside, useDebounceFn } from '@vueuse/core';
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
  PinIcon,
  XIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  ChevronRightIcon,
} from 'lucide-vue-next';
import { toast, CustomSimple } from '@/components/ui/toaster';
import type { DirContents } from '@/types/dir-entry';
import normalizePath from '@/utils/normalize-path';

const props = defineProps<{
  currentPath: string;
}>();

const emit = defineEmits<{
  navigate: [path: string];
}>();

const { t } = useI18n();

const isEditorOpen = ref(false);
const isPinned = ref(false);
const pathQuery = ref('');
const autocompleteList = ref<string[]>([]);
const selectedIndex = ref(-1);
const addressBarRef = ref<HTMLElement | null>(null);
const breadcrumbsContainerRef = ref<HTMLElement | null>(null);
const pathInputRef = ref<InstanceType<typeof Input> | null>(null);
const separatorDropdowns = ref<{ [key: number]: string[] }>({});
const openSeparatorIndex = ref<number | null>(null);

onClickOutside(
  addressBarRef,
  () => {
    if (isEditorOpen.value && !isPinned.value) {
      isEditorOpen.value = false;
    }
  },
  { ignore: [] },
);

const addressParts = computed(() => {
  if (!props.currentPath) return [];

  const parts = props.currentPath.split('/').filter(part => part !== '');
  const formattedParts: Array<{
    path: string;
    name: string;
    isLast: boolean;
  }> = [];

  parts.forEach((part, index) => {
    const pathSegments = parts.slice(0, index + 1);
    let fullPath = pathSegments.join('/');

    if (props.currentPath.startsWith('/')) {
      fullPath = '/' + fullPath;
    }
    else if (!fullPath.includes(':')) {
      fullPath = fullPath + '/';
    }
    else if (index === 0 && fullPath.includes(':')) {
      fullPath = fullPath + '/';
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

function scrollSelectedIntoView() {
  nextTick(() => {
    const selectedElement = document.querySelector('.address-bar__suggestion--selected');

    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  });
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

async function openEditor() {
  const initialPath = props.currentPath;
  pathQuery.value = initialPath;
  selectedIndex.value = -1;
  isEditorOpen.value = true;

  await nextTick();
  pathInputRef.value?.$el?.focus();
  await updateAutocompleteList(initialPath);
}

const debouncedUpdateAutocomplete = useDebounceFn(updateAutocompleteList, 120);

function handlePathInput(value: string | number | undefined) {
  const stringValue = normalizePath(String(value ?? ''));
  pathQuery.value = stringValue;
  selectedIndex.value = -1;
  debouncedUpdateAutocomplete(stringValue);
}

async function updateAutocompleteList(queryValue: string) {
  const normalizedQuery = normalizePath(queryValue).trim();

  if (!normalizedQuery) {
    autocompleteList.value = [];
    return;
  }

  try {
    const result = await invoke<DirContents>('read_dir', { path: normalizedQuery });
    const entries = result.entries
      .filter(entry => entry.is_dir)
      .map(entry => entry.path)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    autocompleteList.value = entries;
  }
  catch {
    try {
      const parentPath = normalizePath(await dirname(normalizedQuery));
      const result = await invoke<DirContents>('read_dir', { path: parentPath });
      const lastSegment = normalizedQuery.split('/').pop()?.toLowerCase() ?? '';
      const entries = result.entries
        .filter(entry => entry.is_dir && entry.name.toLowerCase().startsWith(lastSegment))
        .map(entry => entry.path)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      autocompleteList.value = entries;
    }
    catch {
      autocompleteList.value = [];
    }
  }
}

function handlePathSelect(path: string) {
  pathQuery.value = path;
  emit('navigate', path);

  if (!isPinned.value) {
    isEditorOpen.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();

    if (selectedIndex.value >= 0 && autocompleteList.value[selectedIndex.value]) {
      handlePathSelect(autocompleteList.value[selectedIndex.value]);
    }
    else if (pathQuery.value.trim()) {
      emit('navigate', pathQuery.value.trim());

      if (!isPinned.value) {
        isEditorOpen.value = false;
      }
    }
  }
  else if (event.key === 'Escape') {
    isEditorOpen.value = false;
  }
  else if (event.key === 'ArrowDown') {
    event.preventDefault();

    if (autocompleteList.value.length > 0) {
      selectedIndex.value = (selectedIndex.value + 1) % autocompleteList.value.length;
      scrollSelectedIntoView();
    }
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault();

    if (autocompleteList.value.length > 0) {
      selectedIndex.value = selectedIndex.value <= 0
        ? autocompleteList.value.length - 1
        : selectedIndex.value - 1;
      scrollSelectedIntoView();
    }
  }
  else if (event.key === 'Tab') {
    event.preventDefault();
    event.stopPropagation();

    if (autocompleteList.value.length > 0) {
      if (event.shiftKey) {
        selectedIndex.value = selectedIndex.value <= 0
          ? autocompleteList.value.length - 1
          : selectedIndex.value - 1;
      }
      else {
        selectedIndex.value = (selectedIndex.value + 1) % autocompleteList.value.length;
      }

      if (autocompleteList.value[selectedIndex.value]) {
        pathQuery.value = autocompleteList.value[selectedIndex.value];
      }

      scrollSelectedIntoView();
    }

    pathInputRef.value?.$el?.focus();
  }
}

async function copyPathToClipboard() {
  try {
    await navigator.clipboard.writeText(props.currentPath);
    toast.custom(markRaw(CustomSimple), {
      componentProps: {
        title: t('dialogs.localShareManagerDialog.addressCopiedToClipboard'),
        description: props.currentPath,
      },
      duration: 2000,
    });
  }
  catch (error) {
    console.error('Failed to copy path:', error);
  }
}

async function openCopiedPath() {
  try {
    const clipboardText = await navigator.clipboard.readText();

    if (clipboardText) {
      emit('navigate', clipboardText);
    }
  }
  catch (error) {
    console.error('Failed to read clipboard:', error);
  }
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.ctrlKey && event.key === 'p') {
    event.preventDefault();
    openEditor();
  }
}

onMounted(() => {
  nextTick(() => {
    scrollBreadcrumbsToEnd();
  });
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
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
          <DropdownMenuItem @select="copyPathToClipboard">
            <CopyIcon :size="16" />
            <span>{{ t('settings.addressBar.copyPathToClipboard') }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem @select="openCopiedPath">
            <ClipboardPasteIcon :size="16" />
            <span>{{ t('settings.addressBar.openCopiedPath') }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
        <TooltipContent>
          {{ t('settings.addressBar.addressBarActions') }}
        </TooltipContent>
      </Tooltip>
    </DropdownMenu>
    <template v-if="isEditorOpen">
      <div class="address-bar__editor-row">
        <Input
          ref="pathInputRef"
          :model-value="pathQuery"
          :placeholder="t('settings.addressBar.enterValidPath')"
          class="address-bar__path-input"
          @update:model-value="handlePathInput"
          @keydown="handleKeydown"
        />
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              tabindex="-1"
              class="address-bar__pin-button"
              :class="{ 'address-bar__pin-button--active': isPinned }"
              @click="isPinned = !isPinned"
            >
              <PinIcon :size="14" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ t('settings.addressBar.keepEditorOpened') }}
            <span
              v-if="isPinned"
              class="address-bar__tooltip-status"
            >{{ t('enabled') }}
            </span>
            <span
              v-else
              class="address-bar__tooltip-status"
            >{{ t('disabled') }}
            </span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              tabindex="-1"
              class="address-bar__close-button"
              @click="isEditorOpen = false"
            >
              <XIcon :size="14" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div class="address-bar__tooltip-row">
              {{ t('settings.addressBar.closeEditor') }}
              <ContextMenuShortcut>Esc</ContextMenuShortcut>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
      <div class="address-bar__editor-dropdown">
        <ScrollArea
          v-if="autocompleteList.length > 0"
          class="address-bar__suggestions"
        >
          <button
            v-for="(path, index) in autocompleteList"
            :key="path"
            tabindex="-1"
            class="address-bar__suggestion"
            :class="{ 'address-bar__suggestion--selected': index === selectedIndex }"
            @click="handlePathSelect(path)"
            @mouseenter="selectedIndex = index"
          >
            <FolderIcon
              :size="14"
              class="address-bar__suggestion-icon"
            />
            <span class="address-bar__suggestion-path">{{ path }}</span>
          </button>
        </ScrollArea>
        <div
          v-else
          class="address-bar__empty"
        >
          {{ t('settings.addressBar.noMatchingDirectories') }}
        </div>
        <div class="address-bar__editor-hints">
          <span class="address-bar__hint-key">↑↓</span>
          /
          <span class="address-bar__hint-key">Tab</span>
          /
          <span class="address-bar__hint-key">Shift+Tab</span>
          {{ t('settings.addressBar.toAutocomplete') }};
          <span class="address-bar__hint-key">Enter</span>
          {{ t('settings.addressBar.toOpenThePath') }}
        </div>
      </div>
    </template>
    <template v-else>
      <div
        ref="breadcrumbsContainerRef"
        class="address-bar__breadcrumbs"
        @wheel="handleBreadcrumbsWheel"
        @click="openEditor"
      >
        <div class="address-bar__breadcrumbs-inner">
          <template
            v-for="(part, index) in addressParts"
            :key="index"
          >
            <button
              class="address-bar__part"
              :class="{ 'address-bar__part--last': part.isLast }"
              :disabled="part.isLast"
              :title="part.path"
              @click.stop="navigateToPart(part.path)"
            >
              {{ part.name }}
            </button>
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
                    <span class="address-bar__separator-menu-path">{{ dirPath.split('/').pop() || dirPath }}</span>
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
            <ContextMenuShortcut>Ctrl+P</ContextMenuShortcut>
          </div>
        </TooltipContent>
      </Tooltip>
    </template>
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
  border: 1px solid hsl(var(--border) / 50%);
  border-radius: var(--radius-md);
  background-color: hsl(var(--background) / 50%);
  gap: 2px;
  transition: background-color 0.15s, border-color 0.15s;
}

.address-bar:has(.address-bar__editor-row) {
  overflow: visible;
}

.address-bar__editor-row {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 1;
  align-items: center;
  padding: 0 4px;
  gap: 4px;
}

.address-bar__editor-dropdown {
  position: absolute;
  z-index: 50;
  top: 100%;
  right: 0;
  left: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  margin-top: 4px;
  background-color: hsl(var(--background-3));
  color: hsl(var(--popover-foreground));
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
  color: hsl(var(--foreground) / 80%);
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.1s, color 0.1s;
  white-space: nowrap;
}

.address-bar__part:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.address-bar__part:hover:not(:disabled) {
  background-color: hsl(var(--secondary));
  color: hsl(var(--foreground));
}

.address-bar__part--last {
  color: hsl(var(--muted-foreground));
  cursor: default;
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
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
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

.address-bar__path-input {
  min-width: 0;
  height: calc(100% - 8px);
  flex: 1;
  font-size: 13px;
}

.address-bar__pin-button,
.address-bar__close-button {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.address-bar__pin-button--active {
  background-color: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
}

.address-bar__pin-button--active svg {
  stroke: hsl(var(--primary));
}

.address-bar__suggestions {
  max-height: 140px;
  padding: 4px 0;
}

.address-bar__suggestion {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: hsl(var(--foreground));
  cursor: pointer;
  gap: 8px;
  text-align: left;
  transition: background-color 0.1s;
}

.address-bar__suggestion:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: -2px;
}

.address-bar__suggestion:hover,
.address-bar__suggestion--selected {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.address-bar__suggestion-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.address-bar__suggestion-path {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.address-bar__empty {
  padding: 12px;
  border-top: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-align: center;
}

.address-bar__editor-hints {
  padding: 6px 10px;
  border-top: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  font-size: 10px;
}

.address-bar__hint-key {
  padding: 2px 5px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--muted));
  font-size: 10px;
}

.address-bar__tooltip-status {
  margin-left: 6px;
  color: hsl(var(--primary));
  font-weight: 500;
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
</style>
