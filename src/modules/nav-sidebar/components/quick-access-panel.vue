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
import { StarIcon, TagIcon } from '@lucide/vue';
import QuickAccessEntry from './quick-access-entry.vue';
import QuickAccessSection from './quick-access-section.vue';
import { SortableList } from '@/components/sortable-list';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { registerDropContainer, unregisterDropContainer } from '@/composables/use-drop-target-registry';
import type { QuickAccessSectionId } from '@/types/user-settings';
import type { FavoriteItem, TaggedItem } from '@/types/user-stats';
import { getOrphanedTaggedItems, getTaggedSections, ORPHANED_TAG_ID } from '@/utils/tagged-sections';
import { isVirtualLocationPath } from '@/utils/virtual-locations';
import { openDashboardTagged } from '@/utils/open-dashboard-tagged';
import { openNavigatorNavigablePath } from '@/utils/open-navigator-directory';
import { arePathsEquivalent } from '@/utils/file-operation-paths';
import { haveSameKeyOrder, reorderMatchingItems } from '@/utils/reorder-matching-items';
import { normalizeQuickAccessSectionOrder } from '../utils/quick-access-section-order';

const { t } = useI18n();
const router = useRouter();
const userSettingsStore = useUserSettingsStore();
const userStatsStore = useUserStatsStore();
const workspacesStore = useWorkspacesStore();
const emit = defineEmits<{
  'drag-start': [];
  'drag-end': [];
}>();

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

const tagGroups = computed(() => getTaggedSections(tags.value, taggedItems.value));

const orphanedTaggedItems = computed(() => {
  return getOrphanedTaggedItems(tags.value, taggedItems.value);
});

const totalTaggedItemCount = computed(() => {
  return new Set(taggedItems.value.map(item => item.path)).size;
});

const hasTaggedSectionContent = computed(() => {
  return tagGroups.value.length > 0 || orphanedTaggedItems.value.length > 0;
});

const favoritesOpen = computed({
  get: () => favoritesOpenState.value ?? favoriteItems.value.length > 0,
  set: (value: boolean) => {
    favoritesOpenState.value = value;
  },
});

const tagsOpen = computed({
  get: () => tagsOpenState.value ?? totalTaggedItemCount.value > 0,
  set: (value: boolean) => {
    tagsOpenState.value = value;
  },
});

const sectionOrder = computed(() => {
  return normalizeQuickAccessSectionOrder(userSettingsStore.userSettings.quickAccessSectionOrder);
});

function isFavoriteFile(item: FavoriteItem): boolean {
  if (isVirtualLocationPath(item.path)) {
    return false;
  }

  return !item.path.endsWith('/') && item.path.includes('.');
}

function isCurrentDirectoryItem(path: string, isFile: boolean): boolean {
  const currentPath = workspacesStore.currentTab?.path;
  return !isFile && !!currentPath && arePathsEquivalent(path, currentPath);
}

function openItem(path: string, isFile: boolean) {
  openNavigatorNavigablePath(router, path, isFile);
}

function openFavoriteItem(item: FavoriteItem) {
  openItem(item.path, isFavoriteFile(item));
}

function openTaggedItem(item: TaggedItem) {
  openItem(item.path, item.isFile);
}

function openTagInDashboard(tagId: string) {
  openDashboardTagged(router, tagId);
}

function getSectionKey(sectionId: QuickAccessSectionId): string {
  return sectionId;
}

function getItemKey(item: FavoriteItem | TaggedItem): string {
  return item.path;
}

function getFavoriteEntryProps(item: FavoriteItem) {
  const isFile = isFavoriteFile(item);

  return {
    path: item.path,
    isFile,
    isCurrentDirectoryContext: isCurrentDirectoryItem(item.path, isFile),
  };
}

function getTaggedEntryProps(item: TaggedItem) {
  return {
    path: item.path,
    isFile: item.isFile,
    isCurrentDirectoryContext: isCurrentDirectoryItem(item.path, item.isFile),
  };
}

function handleSectionsReorder(nextItems: QuickAccessSectionId[]) {
  const nextOrder = normalizeQuickAccessSectionOrder(nextItems);

  if (haveSameKeyOrder(sectionOrder.value, nextOrder, getSectionKey)) {
    return;
  }

  userSettingsStore.set('quickAccessSectionOrder', nextOrder);
}

function handleFavoritesReorder(nextItems: FavoriteItem[]) {
  userStatsStore.setFavorites(nextItems);
}

function handleTaggedItemsReorder(nextItems: TaggedItem[]) {
  userStatsStore.setTaggedItems(reorderMatchingItems(
    taggedItems.value,
    nextItems,
    item => item.path,
  ));
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
        <SortableList
          class="quick-access-panel__sections"
          :items="sectionOrder"
          :get-key="getSectionKey"
          handle-selector=".quick-access-panel__section-drag-handle"
          @set="handleSectionsReorder"
          @drag-start="emit('drag-start')"
          @drag-end="emit('drag-end')"
        >
          <template #item="{ item: sectionId }">
            <QuickAccessSection
              v-if="sectionId === 'favorites'"
              v-model:open="favoritesOpen"
              :icon="StarIcon"
              :title="t('quickAccess.favorites')"
              :count="favoriteItems.length"
              :empty-text="t('quickAccess.emptyFavorites')"
              :is-empty="favoriteItems.length === 0"
            >
              <SortableList
                :items="favoriteItems"
                :get-key="getItemKey"
                @set="handleFavoritesReorder"
                @drag-start="emit('drag-start')"
                @drag-end="emit('drag-end')"
              >
                <template #item="{ item }">
                  <QuickAccessEntry
                    v-bind="getFavoriteEntryProps(item)"
                    @open="openFavoriteItem(item)"
                  />
                </template>
              </SortableList>
            </QuickAccessSection>

            <QuickAccessSection
              v-else-if="sectionId === 'tagged'"
              v-model:open="tagsOpen"
              :icon="TagIcon"
              :title="t('quickAccess.tagged')"
              :count="totalTaggedItemCount"
              :empty-text="t('quickAccess.emptyTagged')"
              :is-empty="!hasTaggedSectionContent"
            >
              <div
                v-for="group in tagGroups"
                :key="group.tag.id"
                class="quick-access-panel__tag-group"
              >
                <button
                  type="button"
                  class="quick-access-panel__tag-subtitle"
                  @click="openTagInDashboard(group.tag.id)"
                >
                  <span
                    class="quick-access-panel__tag-dot"
                    :style="{ backgroundColor: group.tag.color }"
                  />
                  <span class="quick-access-panel__tag-name">{{ group.tag.name }}</span>
                  <span class="quick-access-panel__tag-count">{{ group.items.length }}</span>
                </button>
                <SortableList
                  :items="group.items"
                  :get-key="getItemKey"
                  @set="handleTaggedItemsReorder"
                  @drag-start="emit('drag-start')"
                  @drag-end="emit('drag-end')"
                >
                  <template #item="{ item }">
                    <QuickAccessEntry
                      v-bind="getTaggedEntryProps(item)"
                      @open="openTaggedItem(item)"
                    />
                  </template>
                </SortableList>
              </div>
              <div
                v-if="orphanedTaggedItems.length > 0"
                class="quick-access-panel__tag-group"
              >
                <button
                  type="button"
                  class="quick-access-panel__tag-subtitle"
                  @click="openTagInDashboard(ORPHANED_TAG_ID)"
                >
                  <span class="quick-access-panel__tag-dot quick-access-panel__tag-dot--muted" />
                  <span class="quick-access-panel__tag-name">{{ t('quickAccess.unknownTagGroup') }}</span>
                  <span class="quick-access-panel__tag-count">{{ orphanedTaggedItems.length }}</span>
                </button>
                <SortableList
                  :items="orphanedTaggedItems"
                  :get-key="getItemKey"
                  @set="handleTaggedItemsReorder"
                  @drag-start="emit('drag-start')"
                  @drag-end="emit('drag-end')"
                >
                  <template #item="{ item }">
                    <QuickAccessEntry
                      v-bind="getTaggedEntryProps(item)"
                      @open="openTaggedItem(item)"
                    />
                  </template>
                </SortableList>
              </div>
            </QuickAccessSection>
          </template>
        </SortableList>
      </div>
    </ScrollArea>
  </div>
</template>

<style scoped>
.quick-access-panel {
  --tooltip-height: 40px;
  --header-height: 32px;
  --max-height: calc(100vh - 12px - var(--tooltip-height));

  width: var(--quick-access-panel-width);
  max-height: var(--max-height);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}

.quick-access-panel__header {
  height: var(--header-height);
  padding: 6px 16px;
}

.quick-access-panel__title {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-weight: 600;
}

.quick-access-panel__scroll {
  max-height: calc(var(--max-height) - var(--header-height));
}

.quick-access-panel__scroll :deep(.sigma-ui-scroll-area__viewport) {
  max-height: inherit;
}

.quick-access-panel__content {
  display: flex;
  flex-direction: column;
  padding: 8px;
  padding-top: 0;
  gap: 4px;
}

.quick-access-panel__sections :deep(.sortable-list__items) {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  width: 100%;
  align-items: center;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  gap: 6px;
  padding-block: 4px;
  padding-inline: 12px;
  text-align: left;
}

.quick-access-panel__tag-subtitle:hover {
  background-color: hsl(var(--muted) / 50%);
}

.quick-access-panel__tag-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}

.quick-access-panel__tag-dot--muted {
  background-color: hsl(var(--muted-foreground));
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
