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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
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
import {
  TextCursorIcon,
  CopyIcon,
  ClipboardPasteIcon,
  PinIcon,
  XIcon,
  EllipsisVerticalIcon,
  FolderIcon,
} from 'lucide-vue-next';
import { toast, CustomSimple } from '@/components/ui/toaster';
import type { DirContents } from '@/types/dir-entry';

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
const popoverWidth = ref(0);

function updatePopoverWidth() {
  if (addressBarRef.value) {
    popoverWidth.value = addressBarRef.value.offsetWidth;
  }
}

const addressParts = computed(() => {
  if (!props.currentPath) return [];

  const normalizedPath = props.currentPath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/').filter(part => part !== '');
  const formattedParts: Array<{
    path: string;
    name: string;
    isLast: boolean;
  }> = [];

  parts.forEach((part, index) => {
    const pathSegments = parts.slice(0, index + 1);
    let fullPath = pathSegments.join('/');

    if (normalizedPath.startsWith('/')) {
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
  const initialPath = props.currentPath.replace(/\\/g, '/');
  pathQuery.value = initialPath;
  selectedIndex.value = -1;
  updatePopoverWidth();
  isEditorOpen.value = true;

  await nextTick();
  pathInputRef.value?.$el?.focus();
  await updateAutocompleteList(initialPath);
}

async function handlePathInput(value: string | number | undefined) {
  const stringValue = String(value ?? '').replace(/\\/g, '/');
  pathQuery.value = stringValue;
  selectedIndex.value = -1;
  await updateAutocompleteList(stringValue);
}

async function updateAutocompleteList(queryValue: string) {
  const normalizedQuery = queryValue.replace(/\\/g, '/');

  try {
    let dirPath = normalizedQuery;

    try {
      const result = await invoke<DirContents>('read_dir', { path: normalizedQuery });
      const entries = result.entries
        .filter(entry => entry.is_dir)
        .map(entry => entry.path.replace(/\\/g, '/'));
      autocompleteList.value = entries;

      if (normalizedQuery !== props.currentPath.replace(/\\/g, '/')) {
        emit('navigate', normalizedQuery);
      }

      return;
    }
    catch {
      dirPath = await dirname(normalizedQuery);
    }

    const result = await invoke<DirContents>('read_dir', { path: dirPath });
    const queryLower = normalizedQuery.toLowerCase();
    const entries = result.entries
      .filter(entry => entry.is_dir)
      .map(entry => entry.path.replace(/\\/g, '/'))
      .filter(path => path.toLowerCase().startsWith(queryLower));

    autocompleteList.value = entries;
  }
  catch {
    autocompleteList.value = [];
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
    else if (pathQuery.value) {
      emit('navigate', pathQuery.value);

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

    // Keep focus on input
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
    <Popover
      :open="isEditorOpen"
      @update:open="(open: boolean) => { if (open || !isPinned) isEditorOpen = open }"
    >
      <PopoverTrigger as-child>
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
              <span
                v-if="!part.isLast"
                class="address-bar__separator"
              >/</span>
            </template>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        class="address-bar__editor"
        :style="{ width: `${popoverWidth}px` }"
        :side="'bottom'"
        :align="'end'"
        :side-offset="4"
        @open-auto-focus.prevent
        @escape-key-down="(event: KeyboardEvent) => { if (isPinned) event.preventDefault(); else isEditorOpen = false }"
        @pointer-down-outside="(event: Event) => { if (isPinned) event.preventDefault() }"
        @interact-outside="(event: Event) => { if (isPinned) event.preventDefault() }"
      >
        <div class="address-bar__editor-header">
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
              {{ t('settings.addressBar.closeEditor') }}
              <kbd class="shortcut">Esc</kbd>
            </TooltipContent>
          </Tooltip>
        </div>

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
      </PopoverContent>
    </Popover>

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
        {{ t('settings.addressBar.editAddress') }}
        <kbd class="shortcut">Ctrl+P</kbd>
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

.address-bar__part:hover:not(:disabled) {
  background-color: hsl(var(--secondary));
  color: hsl(var(--foreground));
}

.address-bar__part--last {
  color: hsl(var(--muted-foreground));
  cursor: default;
}

.address-bar__separator {
  color: hsl(var(--muted-foreground) / 60%);
  font-size: 13px;
}

</style>

<style>
.address-bar__menu.sigma-ui-dropdown-menu-content {
  min-width: 200px;
}

.address-bar__menu .sigma-ui-dropdown-menu-item {
  gap: 8px;
}

.address-bar__editor.sigma-ui-popover-content {
  min-width: 300px;
  padding: 0;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  background-color: hsl(var(--background-3));
  box-shadow: 0 10px 40px hsl(var(--foreground) / 10%);
  color: hsl(var(--popover-foreground));
}

.address-bar__editor-header {
  display: flex;
  align-items: center;
  padding: 8px;
  gap: 4px;
}

.address-bar__path-input {
  height: 32px;
  flex: 1;
  margin-right: 8px;
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
  max-height: 200px;
  padding: 4px 0;
  border-top: 1px solid hsl(var(--border));
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
  outline: none;
  text-align: left;
  transition: background-color 0.1s;
}

.address-bar__suggestion:hover {
  background-color: hsl(var(--primary) / 30%);
}

.address-bar__suggestion--selected {
  background-color: hsl(var(--primary) / 15%);
  color: hsl(var(--primary) / 90%);
}

.address-bar__suggestion--selected .address-bar__suggestion-icon {
  color: hsl(var(--primary));
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
</style>
