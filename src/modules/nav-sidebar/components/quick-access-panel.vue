<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts">
import { ref } from 'vue';

// FORK-MODIFICATION: 四个 section 的折叠状态。照抄 favorites/tags 的既有做法，
// 用模块级 ref（不持久化），新增 section 沿用同一模式。
const openStates = ref<Record<string, boolean | null>>({});
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  ArrowRightIcon,
  HistoryIcon,
  StarIcon,
  TagIcon,
  TrendingUpIcon,
} from '@lucide/vue';
import QuickAccessEntry from './quick-access-entry.vue';
import QuickAccessSection from './quick-access-section.vue';
import { SortableList } from '@/components/sortable-list';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useScrollRestorationStore } from '@/stores/runtime/scroll-restoration';
import { registerDropContainer, unregisterDropContainer } from '@/composables/use-drop-target-registry';
import type { QuickAccessSectionId } from '@/types/user-settings';
import type {
  FavoriteItem,
  FrequentItem,
  HistoryItem,
  ItemTag,
  TaggedItem,
} from '@/types/user-stats';
import { isVirtualLocationPath } from '@/utils/virtual-locations';
import { openNavigatorNavigablePath } from '@/utils/open-navigator-directory';
import { arePathsEquivalent } from '@/utils/file-operation-paths';
import { haveSameKeyOrder, reorderMatchingItems } from '@/utils/reorder-matching-items';
import { normalizeQuickAccessSectionOrder } from '../utils/quick-access-section-order';

const { t } = useI18n();
const router = useRouter();
const userSettingsStore = useUserSettingsStore();
const userStatsStore = useUserStatsStore();
const workspacesStore = useWorkspacesStore();
const scrollRestorationStore = useScrollRestorationStore();
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
// FORK-MODIFICATION: 需求 N3② —— 「常用」「历史」两个 section 的数据源，
// 与仪表盘页用的是同两个 store 字段，上限 100 也一致。
const frequentItems = computed(() => userStatsStore.sortedFrequentItems);
const historyItems = computed(() => userStatsStore.sortedHistory);

interface TagGroup {
  tag: ItemTag;
  items: TaggedItem[];
}

const knownTagIds = computed(() => new Set(tags.value.map(tag => tag.id)));

const tagGroups = computed<TagGroup[]>(() => {
  return tags.value
    .map(tag => ({
      tag,
      items: taggedItems.value.filter(item => item.tagIds.includes(tag.id)),
    }))
    .filter(group => group.items.length > 0);
});

const orphanedTaggedItems = computed(() => {
  return taggedItems.value.filter(
    item => !item.tagIds.some(tagId => knownTagIds.value.has(tagId)),
  );
});

const totalTaggedItemCount = computed(() => {
  return new Set(taggedItems.value.map(item => item.path)).size;
});

const hasTaggedSectionContent = computed(() => {
  return tagGroups.value.length > 0 || orphanedTaggedItems.value.length > 0;
});

// FORK-MODIFICATION: 折叠状态收敛成一个按 sectionId 索引的表，
// 让新增的 frequent / history 直接复用同一套逻辑。
function useSectionOpenState(
  sectionId: QuickAccessSectionId,
  defaultOpen: () => boolean,
) {
  return computed({
    get: () => openStates.value[sectionId] ?? defaultOpen(),
    set: (value: boolean) => {
      openStates.value = {
        ...openStates.value,
        [sectionId]: value,
      };
    },
  });
}

const favoritesOpen = useSectionOpenState('favorites', () => favoriteItems.value.length > 0);

const tagsOpen = useSectionOpenState('tagged', () => totalTaggedItemCount.value > 0);

const frequentOpen = useSectionOpenState('frequent', () => frequentItems.value.length > 0);

const historyOpen = useSectionOpenState('history', () => historyItems.value.length > 0);

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

function getSectionKey(sectionId: QuickAccessSectionId): string {
  return sectionId;
}

// FORK-MODIFICATION: 需求 N3③ —— 判断是否需要在分组上方画分隔线。
function isNotFirstSection(sectionId: QuickAccessSectionId): boolean {
  return sectionOrder.value.indexOf(sectionId) > 0;
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

function handleItemDragEnd() {
  function swallowClick(clickEvent: MouseEvent) {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
    window.removeEventListener('click', swallowClick, true);
  }

  window.addEventListener('click', swallowClick, true);
  window.setTimeout(() => {
    window.removeEventListener('click', swallowClick, true);
  }, 0);
  emit('drag-end');
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

// FORK-MODIFICATION: 需求 N3⑤（决策 D4）——点「常用」「历史」的标题时切到
// 仪表盘对应页签。先跳到仪表盘路由，再设 activeTab：
// 仪表盘页若尚未挂载，页内 setup 时的一次性读取会取到这个值；
// 若已挂载，由 `useRestoredActiveTab` 里新增的反向 watch 接住（否则点了没反应）。
function openDashboardTab(tab: 'frequent' | 'history') {
  void router.push({ name: 'dashboard' }).then(() => {
    scrollRestorationStore.setActiveTab('dashboard', tab);
  });
}

function getFrequentEntryProps(item: FrequentItem) {
  return {
    path: item.path,
    isFile: item.isFile,
    isCurrentDirectoryContext: isCurrentDirectoryItem(item.path, item.isFile),
  };
}

function getHistoryEntryProps(item: HistoryItem) {
  return {
    path: item.path,
    isFile: item.isFile,
    isCurrentDirectoryContext: isCurrentDirectoryItem(item.path, item.isFile),
  };
}
</script>

<template>
  <div
    ref="panelRef"
    class="quick-access-panel"
  >
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
            <!-- FORK-MODIFICATION: 需求 N3③ —— 四组之间加横线分隔。
                 第一组上方不画。索引自己从 sectionOrder 算，
                 不改 SortableList 的 item 插槽签名（那是全局共用组件）。 -->
            <div
              v-if="isNotFirstSection(sectionId)"
              class="quick-access-panel__separator"
            />
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
                @drag-end="handleItemDragEnd"
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
                <div class="quick-access-panel__tag-subtitle">
                  <span
                    class="quick-access-panel__tag-dot"
                    :style="{ backgroundColor: group.tag.color }"
                  />
                  <span class="quick-access-panel__tag-name">{{ group.tag.name }}</span>
                  <span class="quick-access-panel__tag-count">{{ group.items.length }}</span>
                </div>
                <SortableList
                  :items="group.items"
                  :get-key="getItemKey"
                  @set="handleTaggedItemsReorder"
                  @drag-start="emit('drag-start')"
                  @drag-end="handleItemDragEnd"
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
                <div class="quick-access-panel__tag-subtitle">
                  <span class="quick-access-panel__tag-dot quick-access-panel__tag-dot--muted" />
                  <span class="quick-access-panel__tag-name">{{ t('quickAccess.unknownTagGroup') }}</span>
                  <span class="quick-access-panel__tag-count">{{ orphanedTaggedItems.length }}</span>
                </div>
                <SortableList
                  :items="orphanedTaggedItems"
                  :get-key="getItemKey"
                  @set="handleTaggedItemsReorder"
                  @drag-start="emit('drag-start')"
                  @drag-end="handleItemDragEnd"
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

            <!-- FORK-MODIFICATION: 需求 N3②⑤ —— 「常用」分组。
                 标题右侧的按钮跳到仪表盘「常用」页签（决策 D4）。 -->
            <QuickAccessSection
              v-else-if="sectionId === 'frequent'"
              v-model:open="frequentOpen"
              :icon="TrendingUpIcon"
              :title="t('quickAccess.frequent')"
              :count="frequentItems.length"
              :empty-text="t('quickAccess.emptyFrequent')"
              :is-empty="frequentItems.length === 0"
            >
              <template #header-action>
                <button
                  type="button"
                  class="quick-access-panel__section-action"
                  :title="t('quickAccess.openFrequentTab')"
                  @click.stop="openDashboardTab('frequent')"
                >
                  <ArrowRightIcon :size="14" />
                </button>
              </template>
              <QuickAccessEntry
                v-for="item in frequentItems"
                :key="item.path"
                v-bind="getFrequentEntryProps(item)"
                @open="openItem(item.path, item.isFile)"
              />
            </QuickAccessSection>

            <!-- FORK-MODIFICATION: 需求 N3②⑤ —— 「历史」分组，同上。 -->
            <QuickAccessSection
              v-else-if="sectionId === 'history'"
              v-model:open="historyOpen"
              :icon="HistoryIcon"
              :title="t('quickAccess.history')"
              :count="historyItems.length"
              :empty-text="t('quickAccess.emptyHistory')"
              :is-empty="historyItems.length === 0"
            >
              <template #header-action>
                <button
                  type="button"
                  class="quick-access-panel__section-action"
                  :title="t('quickAccess.openHistoryTab')"
                  @click.stop="openDashboardTab('history')"
                >
                  <ArrowRightIcon :size="14" />
                </button>
              </template>
              <QuickAccessEntry
                v-for="item in historyItems"
                :key="`${item.path}::${item.openedAt}`"
                v-bind="getHistoryEntryProps(item)"
                @open="openItem(item.path, item.isFile)"
              />
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
  --max-height: calc(100vh - 12px - var(--tooltip-height));

  width: var(--quick-access-panel-width);
  max-height: var(--max-height);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}

/* FORK-MODIFICATION: 需求 N3① 删掉「快速访问」标题行后不再需要扣掉表头高度 */
.quick-access-panel__scroll {
  max-height: var(--max-height);
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

/* FORK-MODIFICATION: 需求 N3③ —— 分组之间的横线分隔 */
.quick-access-panel__separator {
  height: 1px;
  flex-shrink: 0;
  margin-block: 4px;
  background-color: hsl(var(--border) / 50%);
}

/* FORK-MODIFICATION: 需求 N3⑤ —— 跳仪表盘页签的标题右侧按钮 */
.quick-access-panel__section-action {
  display: inline-flex;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

.quick-access-panel__section-action:hover {
  background-color: hsl(var(--foreground) / 5%);
  color: hsl(var(--foreground));
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
  gap: 6px;
  padding-block: 4px;
  padding-inline: 12px;
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
