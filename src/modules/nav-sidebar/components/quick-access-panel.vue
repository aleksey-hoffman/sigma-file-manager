<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  StarIcon,
  TagIcon,
} from 'lucide-vue-next';
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from 'reka-ui';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import type { FavoriteItem, ItemTag, TaggedItem } from '@/types/user-stats';

const { t } = useI18n();
const router = useRouter();
const userStatsStore = useUserStatsStore();
const workspacesStore = useWorkspacesStore();

const favoritesOpen = ref(true);
const tagsOpen = ref(true);

const favoriteItems = computed(() => userStatsStore.favorites);
const taggedItems = computed(() => userStatsStore.taggedItems);
const tags = computed(() => userStatsStore.tags);

function getTagById(tagId: string): ItemTag | undefined {
  return tags.value.find(tag => tag.id === tagId);
}

function getItemName(path: string): string {
  if (!path) return '';
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] || path;
}

function isFavoriteFile(item: FavoriteItem): boolean {
  return !item.path.endsWith('/') && item.path.includes('.');
}

async function openItem(path: string, isFile: boolean) {
  try {
    if (isFile) {
      const lastSlashIndex = path.lastIndexOf('/');
      const directory = lastSlashIndex > 0 ? path.substring(0, lastSlashIndex) : path;
      await workspacesStore.openNewTabGroup(directory);
    }
    else {
      await workspacesStore.openNewTabGroup(path);
    }

    router.push({ name: 'navigator' });
  }
  catch (error) {
    console.error('Failed to open item:', error);
  }
}

async function openFavoriteItem(item: FavoriteItem) {
  await openItem(item.path, isFavoriteFile(item));
}

function openTaggedItem(item: TaggedItem) {
  openItem(item.path, item.isFile);
}
</script>

<template>
  <div class="quick-access-panel">
    <div class="quick-access-panel__header">
      <span class="quick-access-panel__title">{{ t('quickAccess.title') }}</span>
    </div>

    <ScrollArea class="quick-access-panel__scroll">
      <div class="quick-access-panel__content">
        <CollapsibleRoot
          v-model:open="favoritesOpen"
          class="quick-access-panel__section"
        >
          <CollapsibleTrigger
            as-child
            class="quick-access-panel__section-trigger"
          >
            <button
              type="button"
              class="quick-access-panel__section-header"
            >
              <ChevronDownIcon
                v-if="favoritesOpen"
                :size="14"
                class="quick-access-panel__chevron"
              />
              <ChevronRightIcon
                v-else
                :size="14"
                class="quick-access-panel__chevron"
              />
              <StarIcon
                :size="14"
                class="quick-access-panel__section-icon"
              />
              <span class="quick-access-panel__section-title">{{ t('quickAccess.favorites') }}</span>
              <span
                v-if="favoriteItems.length > 0"
                class="quick-access-panel__badge"
              >
                {{ favoriteItems.length }}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent class="quick-access-panel__section-content">
            <div
              class="quick-access-panel__empty"
              v-if="favoriteItems.length === 0"
            >
              {{ t('quickAccess.emptyFavorites') }}
            </div>
            <button
              v-for="item in favoriteItems"
              :key="item.path"
              type="button"
              class="quick-access-panel__item"
              @click="openFavoriteItem(item)"
            >
              <FolderIcon
                v-if="!isFavoriteFile(item)"
                :size="14"
                class="quick-access-panel__item-icon"
              />
              <FileIcon
                v-else
                :size="14"
                class="quick-access-panel__item-icon"
              />
              <span class="quick-access-panel__item-name">{{ getItemName(item.path) }}</span>
            </button>
          </CollapsibleContent>
        </CollapsibleRoot>

        <CollapsibleRoot
          v-model:open="tagsOpen"
          class="quick-access-panel__section"
        >
          <CollapsibleTrigger
            as-child
            class="quick-access-panel__section-trigger"
          >
            <button
              type="button"
              class="quick-access-panel__section-header"
            >
              <ChevronDownIcon
                v-if="tagsOpen"
                :size="14"
                class="quick-access-panel__chevron"
              />
              <ChevronRightIcon
                v-else
                :size="14"
                class="quick-access-panel__chevron"
              />
              <TagIcon
                :size="14"
                class="quick-access-panel__section-icon"
              />
              <span class="quick-access-panel__section-title">{{ t('quickAccess.tagged') }}</span>
              <span
                v-if="taggedItems.length > 0"
                class="quick-access-panel__badge"
              >
                {{ taggedItems.length }}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent class="quick-access-panel__section-content">
            <div
              class="quick-access-panel__empty"
              v-if="taggedItems.length === 0"
            >
              {{ t('quickAccess.emptyTagged') }}
            </div>
            <button
              v-for="item in taggedItems"
              :key="item.path"
              type="button"
              class="quick-access-panel__item"
              @click="openTaggedItem(item)"
            >
              <FolderIcon
                v-if="!item.isFile"
                :size="14"
                class="quick-access-panel__item-icon"
              />
              <FileIcon
                v-else
                :size="14"
                class="quick-access-panel__item-icon"
              />
              <span class="quick-access-panel__item-name">{{ getItemName(item.path) }}</span>
              <div class="quick-access-panel__item-tags">
                <span
                  v-for="tagId in item.tagIds"
                  :key="tagId"
                  class="quick-access-panel__tag"
                  :style="{
                    backgroundColor: (getTagById(tagId)?.color ?? '#666') + '25',
                    color: getTagById(tagId)?.color ?? '#666',
                  }"
                >
                  {{ getTagById(tagId)?.name }}
                </span>
              </div>
            </button>
          </CollapsibleContent>
        </CollapsibleRoot>
      </div>
    </ScrollArea>
  </div>
</template>

<style scoped>
.quick-access-panel {
  display: flex;
  width: var(--quick-access-panel-width);
  height: 100%;
  flex-direction: column;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}

.quick-access-panel__header {
  flex-shrink: 0;
  padding: 12px 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.quick-access-panel__title {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-weight: 600;
}

.quick-access-panel__scroll {
  overflow: hidden;
  height: 100%;
  min-height: 0;
  flex: 1;
}

.quick-access-panel__content {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 4px;
}

.quick-access-panel__section {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-sm);
}

.quick-access-panel__section-trigger {
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.quick-access-panel__section-header {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  gap: 8px;
  text-align: left;
  transition: background-color 0.15s ease;
}

.quick-access-panel__section-header:hover {
  background-color: hsl(var(--foreground) / 5%);
}

.quick-access-panel__chevron {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.quick-access-panel__section-icon {
  flex-shrink: 0;
  color: hsl(var(--icon));
}

.quick-access-panel__section-title {
  overflow: hidden;
  flex: 1;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-access-panel__badge {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 10px;
  background-color: hsl(var(--primary) / 20%);
  color: hsl(var(--primary));
  font-size: 0.6875rem;
  font-weight: 600;
}

.quick-access-panel__section-content {
  overflow: hidden;
  padding-bottom: 4px;
  padding-left: 22px;
}

.quick-access-panel__section-content[data-state="open"] {
  animation: sigma-ui-collapsible-down 0.2s ease-out;
}

.quick-access-panel__section-content[data-state="closed"] {
  padding-top: 0;
  padding-bottom: 0;
  animation: sigma-ui-collapsible-up 0.2s ease-out;
}

.quick-access-panel__empty {
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.quick-access-panel__item {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  align-items: center;
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  gap: 6px 8px;
  text-align: left;
  transition: background-color 0.15s ease;
}

.quick-access-panel__item:hover {
  background-color: hsl(var(--foreground) / 5%);
}

.quick-access-panel__item-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.quick-access-panel__item-name {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-access-panel__item-tags {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 4px;
}

.quick-access-panel__tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 500;
}
</style>
