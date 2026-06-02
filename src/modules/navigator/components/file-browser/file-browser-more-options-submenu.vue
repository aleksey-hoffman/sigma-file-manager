<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';
import { ContextMenuSub } from 'reka-ui';
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import {
  MoreHorizontalIcon,
  Loader2Icon,
} from '@lucide/vue';

type MenuItemSource = 'legacy' | 'modern';

interface ShellContextMenuItem {
  id: number;
  name: string;
  verb: string | null;
  icon: string | null;
  children: ShellContextMenuItem[] | null;
  source?: MenuItemSource;
  isSeparator?: false;
}

interface MenuSeparatorItem {
  id: 0;
  name: string;
  verb: null;
  icon: null;
  children: null;
  isSeparator: true;
}

type MenuListItem = ShellContextMenuItem | MenuSeparatorItem;

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

const triggerLabel = computed(() =>
  t('moreOptions.shellExtensions'),
);

const isLoading = ref(false);
const menuItems = ref<MenuListItem[]>([]);
const loadError = ref<string | null>(null);
const hasLoadedForPath = ref<string | null>(null);

function normalizeMenuItemName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function filterMenuItems(items: ShellContextMenuItem[], source: MenuItemSource): ShellContextMenuItem[] {
  return items
    .filter(item => item.name && !item.name.startsWith('-'))
    .filter(item => item.id > 0 || (item.children && item.children.length > 0))
    .map(item => ({
      ...item,
      source,
      children: item.children ? filterMenuItems(item.children, source) : null,
    }));
}

function uniqueModernItems(
  modernItems: ShellContextMenuItem[],
  legacyItems: ShellContextMenuItem[],
) {
  const legacyNames = new Set(
    legacyItems.map(item => normalizeMenuItemName(item.name)),
  );

  return modernItems.filter(item => !legacyNames.has(normalizeMenuItemName(item.name)));
}

function buildCombinedMenuItems(
  modernItems: ShellContextMenuItem[],
  legacyItems: ShellContextMenuItem[],
): MenuListItem[] {
  if (modernItems.length === 0) {
    return legacyItems;
  }

  if (legacyItems.length === 0) {
    return modernItems;
  }

  return [
    ...modernItems,
    {
      id: 0,
      name: '__separator__',
      verb: null,
      icon: null,
      children: null,
      isSeparator: true,
    },
    ...legacyItems,
  ];
}

async function loadShellContextMenu() {
  const entries = props.selectedEntries;
  if (entries.length === 0) return;

  const cacheKey = entries.map(entry => entry.path).join('|');
  if (cacheKey === hasLoadedForPath.value && menuItems.value.length > 0) return;

  isLoading.value = true;
  loadError.value = null;

  if (hasLoadedForPath.value !== cacheKey) {
    menuItems.value = [];
  }

  hasLoadedForPath.value = cacheKey;

  try {
    const [legacyResult, modernResult] = await Promise.all([
      invoke<GetShellContextMenuResult>('get_shell_context_menu', {
        filePath: entries[0].path,
      }).catch(invokeError => ({
        success: false,
        items: [],
        error: String(invokeError),
      })),
      invoke<GetShellContextMenuResult>('get_modern_context_menu', {
        filePaths: entries.map(entry => entry.path),
      }).catch(invokeError => ({
        success: false,
        items: [],
        error: String(invokeError),
      })),
    ]);

    if (legacyResult.success || modernResult.success) {
      const legacyItems = legacyResult.success
        ? filterMenuItems(legacyResult.items, 'legacy')
        : [];
      const modernItems = modernResult.success
        ? uniqueModernItems(filterMenuItems(modernResult.items, 'modern'), legacyItems)
        : [];

      if (!legacyResult.success) {
        console.error('Failed to load shell context menu:', legacyResult.error);
      }

      if (!modernResult.success) {
        console.error('Failed to load modern context menu:', modernResult.error);
      }

      menuItems.value = buildCombinedMenuItems(modernItems, legacyItems);
    }
    else {
      loadError.value = legacyResult.error || modernResult.error || t('moreOptions.failedToLoad');
    }
  }
  catch (invokeError) {
    loadError.value = String(invokeError);
  }
  finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadShellContextMenu();
});

async function invokeMenuItem(item: MenuListItem) {
  if (item.isSeparator) return;
  if (props.selectedEntries.length === 0 || !item.id) return;

  try {
    if (item.source === 'modern') {
      const result = await invoke<OpenWithResult>('invoke_modern_context_menu_item', {
        filePaths: props.selectedEntries.map(entry => entry.path),
        commandId: item.id,
      });

      if (!result.success) {
        console.error('Failed to invoke modern context menu command:', result.error);
      }

      return;
    }

    for (const entry of props.selectedEntries) {
      const result = await invoke<OpenWithResult>('invoke_shell_context_menu_item', {
        filePath: entry.path,
        commandId: item.id,
        commandVerb: item.verb,
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
      <span>{{ triggerLabel }}</span>
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
              :key="item.isSeparator ? item.name : `${item.source}-${item.id}-${item.name}`"
            >
              <ContextMenuSeparator v-if="item.isSeparator" />
              <ContextMenuSub v-else-if="item.children && item.children.length > 0">
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
                      @select="invokeMenuItem(child)"
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
                @select="invokeMenuItem(item)"
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
  overflow: hidden auto;
  max-height: 400px;
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
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.more-options-submenu__item > span:last-child {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
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
