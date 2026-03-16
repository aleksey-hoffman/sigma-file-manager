<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts">
import { ref } from 'vue';

const favoritesOpenState = ref<boolean | null>(null);
const tagsOpenState = ref<boolean | null>(null);
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  StarIcon,
  TagIcon,
} from 'lucide-vue-next';
import QuickAccessItemIcon from './quick-access-item-icon.vue';
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from 'reka-ui';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DirEntryInteractive } from '@/components/dir-entry-interactive';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { registerDropContainer, unregisterDropContainer } from '@/composables/use-drop-target-registry';
import type { FavoriteItem, ItemTag, TaggedItem } from '@/types/user-stats';

const { t } = useI18n();
const router = useRouter();
const userStatsStore = useUserStatsStore();
const workspacesStore = useWorkspacesStore();

const panelRef = ref<HTMLElement | null>(null);
let dropContainerId: number | null = null;

onMounted(() => {
  dropContainerId = registerDropContainer({
    componentRef: panelRef,
    entriesContainerRef: panelRef,
    disableBackgroundDrop: true,
  });
});

onUnmounted(() => {
  if (dropContainerId !== null) {
    unregisterDropContainer(dropContainerId);
  }
});

const favoriteItems = computed(() => userStatsStore.favorites);
const taggedItems = computed(() => userStatsStore.taggedItems);
const tags = computed(() => userStatsStore.tags);

interface TagGroup {
  tag: ItemTag;
  items: TaggedItem[];
}

const tagGroups = computed<TagGroup[]>(() => {
  return tags.value
    .map(tag => ({
      tag,
      items: taggedItems.value.filter(item => item.tagIds.includes(tag.id)),
    }))
    .filter(group => group.items.length > 0);
});

const totalTaggedItemCount = computed(() => {
  return new Set(taggedItems.value.map(item => item.path)).size;
});

const favoritesOpen = computed({
  get: () => favoritesOpenState.value ?? favoriteItems.value.length > 0,
  set: (value: boolean) => { favoritesOpenState.value = value; },
});

const tagsOpen = computed({
  get: () => tagsOpenState.value ?? tagGroups.value.length > 0,
  set: (value: boolean) => { tagsOpenState.value = value; },
});

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
  <div
    ref="panelRef"
    class="quick-access-panel"
  >
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
            <DirEntryInteractive
              v-for="item in favoriteItems"
              :key="item.path"
              :path="item.path"
              :is-file="isFavoriteFile(item)"
            >
              <button
                type="button"
                class="quick-access-panel__item"
                @click="openFavoriteItem(item)"
              >
                <QuickAccessItemIcon
                  :path="item.path"
                  :is-file="isFavoriteFile(item)"
                  :size="14"
                />
                <span class="quick-access-panel__item-name">{{ getItemName(item.path) }}</span>
              </button>
            </DirEntryInteractive>
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
                v-if="totalTaggedItemCount > 0"
                class="quick-access-panel__badge"
              >
                {{ totalTaggedItemCount }}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent class="quick-access-panel__section-content">
            <div
              class="quick-access-panel__empty"
              v-if="tagGroups.length === 0"
            >
              {{ t('quickAccess.emptyTagged') }}
            </div>
            <div
              v-for="group in tagGroups"
              :key="group.tag.id"
              class="quick-access-panel__tag-group"
            >
              <div class="quick-access-panel__tag-subtitle">
                <span
                  class="quick-access-panel__tag-dot"
                  :style="{ backgroundColor: group.tag.color }"
                />
                <span class="quick-access-panel__tag-name">{{ group.tag.name }}</span>
                <span class="quick-access-panel__tag-count">{{ group.items.length }}</span>
              </div>
              <DirEntryInteractive
                v-for="item in group.items"
                :key="item.path"
                :path="item.path"
                :is-file="item.isFile"
              >
                <button
                  type="button"
                  class="quick-access-panel__item"
                  @click="openTaggedItem(item)"
                >
                  <QuickAccessItemIcon
                    :path="item.path"
                    :is-file="item.isFile"
                    :size="14"
                  />
                  <span class="quick-access-panel__item-name">{{ getItemName(item.path) }}</span>
                </button>
              </DirEntryInteractive>
            </div>
          </CollapsibleContent>
        </CollapsibleRoot>
      </div>
    </ScrollArea>
  </div>
</template>

<style scoped>
.quick-access-panel {
  --_header-height: 45px;
  --_max-height: calc(100vh - 12px);

  width: var(--quick-access-panel-width);
  max-height: var(--_max-height);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}

.quick-access-panel__header {
  height: var(--_header-height);
  padding: 12px 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.quick-access-panel__title {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-weight: 600;
}

.quick-access-panel__scroll {
  max-height: calc(var(--_max-height) - var(--_header-height));
}

.quick-access-panel__scroll :deep(.sigma-ui-scroll-area__viewport) {
  max-height: inherit;
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
  padding-left: 8px;
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
  border-radius: var(--radius-sm);
  background-color: hsl(var(--primary) / 20%);
  color: hsl(var(--primary));
  font-size: 0.6875rem;
  font-weight: 600;
}

.quick-access-panel__section-content {
  overflow: hidden;
  padding-bottom: 4px;
  padding-left: 20px;
  margin-right: 8px;
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
  align-items: center;
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  gap: 8px;
  text-align: left;
  transition: background-color 0.15s ease;
}

.quick-access-panel__item:hover {
  background-color: hsl(var(--foreground) / 5%);
}

:deep(.dir-entry-interactive[data-drag-over]) > .quick-access-panel__item {
  background-color: hsl(var(--primary) / 15%);
  box-shadow: inset 0 0 0 2px hsl(var(--primary) / 60%);
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

.quick-access-panel__tag-group {
  display: flex;
  flex-direction: column;
}

.quick-access-panel__tag-group + .quick-access-panel__tag-group {
  margin-top: 4px;
}

.quick-access-panel__tag-subtitle {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  gap: 6px;
}

.quick-access-panel__tag-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}

.quick-access-panel__tag-name {
  overflow: hidden;
  flex: 1;
  color: hsl(var(--muted-foreground));
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.quick-access-panel__tag-count {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--primary) / 20%);
  color: hsl(var(--primary));
  font-size: 0.6875rem;
  font-weight: 600;
}
</style>
