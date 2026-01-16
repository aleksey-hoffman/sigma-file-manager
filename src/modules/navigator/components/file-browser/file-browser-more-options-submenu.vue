<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';
import { ContextMenuSub } from 'reka-ui';
import {
  ContextMenuItem,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import {
  MoreHorizontalIcon,
  Loader2Icon,
} from 'lucide-vue-next';

interface ShellContextMenuItem {
  id: number;
  name: string;
  verb: string | null;
  icon: string | null;
  children: ShellContextMenuItem[] | null;
}

interface GetShellContextMenuResult {
  success: boolean;
  items: ShellContextMenuItem[];
  error: string | null;
}

interface OpenWithResult {
  success: boolean;
  error: string | null;
}

const props = defineProps<{
  selectedEntries: DirEntry[];
}>();

const { t } = useI18n();

const isLoading = ref(false);
const menuItems = ref<ShellContextMenuItem[]>([]);
const loadError = ref<string | null>(null);

const firstEntry = computed(() => props.selectedEntries[0]);
const lastLoadedPath = ref<string | null>(null);

function filterMenuItems(items: ShellContextMenuItem[]): ShellContextMenuItem[] {
  return items
    .filter(item => item.name && !item.name.startsWith('-'))
    .filter(item => item.id > 0 || (item.children && item.children.length > 0))
    .map(item => ({
      ...item,
      children: item.children ? filterMenuItems(item.children) : null,
    }));
}

async function loadShellContextMenu() {
  if (!firstEntry.value) return;

  const currentPath = firstEntry.value.path;
  if (currentPath === lastLoadedPath.value) return;

  isLoading.value = true;
  loadError.value = null;
  menuItems.value = [];
  lastLoadedPath.value = currentPath;

  try {
    const result = await invoke<GetShellContextMenuResult>('get_shell_context_menu', {
      filePath: currentPath,
    });

    if (result.success) {
      menuItems.value = filterMenuItems(result.items);
    }
    else {
      loadError.value = result.error || t('moreOptions.failedToLoad');
    }
  }
  catch (invokeError) {
    loadError.value = String(invokeError);
  }
  finally {
    isLoading.value = false;
  }
}

watch(
  () => firstEntry.value?.path,
  () => {
    lastLoadedPath.value = null;
    loadShellContextMenu();
  },
  { immediate: true },
);

async function invokeMenuItem(commandId: number) {
  if (!firstEntry.value || !commandId) return;

  try {
    for (const entry of props.selectedEntries) {
      const result = await invoke<OpenWithResult>('invoke_shell_context_menu_item', {
        filePath: entry.path,
        commandId: commandId,
      });

      if (!result.success) {
        console.error('Failed to invoke shell command:', result.error);
        return;
      }
    }
  }
  catch (invokeError) {
    console.error('Failed to invoke shell command:', invokeError);
  }
}
</script>

<template>
  <ContextMenuSub>
    <ContextMenuSubTrigger>
      <MoreHorizontalIcon :size="16" />
      <span>{{ t('moreOptions.shellExtensions') }}</span>
    </ContextMenuSubTrigger>
    <ContextMenuSubContent class="more-options-submenu">
      <div class="more-options-submenu__scroll-container">
        <div
          v-if="isLoading"
          class="more-options-submenu__loading"
        >
          <Loader2Icon
            :size="16"
            class="more-options-submenu__spinner"
          />
          <span>{{ t('moreOptions.loading') }}</span>
        </div>

        <template v-else-if="loadError">
          <div class="more-options-submenu__error">
            {{ loadError }}
          </div>
        </template>

        <template v-else>
          <template v-if="menuItems.length > 0">
            <template
              v-for="item in menuItems"
              :key="item.id || item.name"
            >
              <ContextMenuSub v-if="item.children && item.children.length > 0">
                <ContextMenuSubTrigger class="more-options-submenu__item">
                  <span class="more-options-submenu__item-icon">
                    <img
                      v-if="item.icon"
                      :src="item.icon"
                      class="more-options-submenu__item-icon-img"
                    >
                  </span>
                  <span>{{ item.name }}</span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent class="more-options-submenu more-options-submenu--nested">
                  <div class="more-options-submenu__scroll-container more-options-submenu__scroll-container--nested">
                    <ContextMenuItem
                      v-for="child in item.children"
                      :key="child.id"
                      class="more-options-submenu__item"
                      @select="invokeMenuItem(child.id)"
                    >
                      <span class="more-options-submenu__item-icon">
                        <img
                          v-if="child.icon"
                          :src="child.icon"
                          class="more-options-submenu__item-icon-img"
                        >
                      </span>
                      <span>{{ child.name }}</span>
                    </ContextMenuItem>
                  </div>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuItem
                v-else
                class="more-options-submenu__item"
                @select="invokeMenuItem(item.id)"
              >
                <span class="more-options-submenu__item-icon">
                  <img
                    v-if="item.icon"
                    :src="item.icon"
                    class="more-options-submenu__item-icon-img"
                  >
                </span>
                <span>{{ item.name }}</span>
              </ContextMenuItem>
            </template>
          </template>

          <template v-else>
            <div class="more-options-submenu__empty">
              {{ t('moreOptions.noOptionsAvailable') }}
            </div>
          </template>
        </template>
      </div>
    </ContextMenuSubContent>
  </ContextMenuSub>
</template>

<style>
.more-options-submenu {
  min-width: 200px;
  max-width: 320px;
  padding: 4px 0;
}

.more-options-submenu__scroll-container {
  max-height: 400px;
  overflow-y: auto;
  scrollbar-color: hsl(var(--border)) transparent;
  scrollbar-width: thin;
}

.more-options-submenu__scroll-container--nested {
  max-height: 300px;
}

.more-options-submenu__scroll-container::-webkit-scrollbar {
  width: 8px;
}

.more-options-submenu__scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.more-options-submenu__scroll-container::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background-color: hsl(var(--border));
}

.more-options-submenu__loading {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  gap: 8px;
}

.more-options-submenu__spinner {
  animation: more-options-spin 1s linear infinite;
}

@keyframes more-options-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.more-options-submenu__error {
  padding: 8px 12px;
  color: hsl(var(--destructive));
  font-size: 13px;
}

.more-options-submenu__empty {
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.more-options-submenu__item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.more-options-submenu__item-icon {
  display: flex;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.more-options-submenu__item-icon-img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}
</style>
