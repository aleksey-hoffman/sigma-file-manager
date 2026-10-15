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
  FolderIcon,
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
import { groupFavoritesByCategory } from '../utils/group-favorites-by-category';

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
const favoriteCategories = computed(() => userStatsStore.favoriteCategories);
const taggedItems = computed(() => userStatsStore.taggedItems);
const tags = computed(() => userStatsStore.tags);

// FORK-MODIFICATION: 反馈 5（2026-10-15）——侧边栏收藏夹按分类分组。
// 之前是一列平铺：分类在仪表盘建好之后，侧边栏这边完全看不出来，
// 于是「收藏」和「标记」这两种组织只有仪表盘页才有。
// 分组规则本身放在 utils/group-favorites-by-category.ts（可单测），
// 这里只负责把结果渲染成「分组标题 + 组内独立 SortableList」。
const favoriteGroups = computed(() => {
  return groupFavoritesByCategory(favoriteItems.value, favoriteCategories.value);
});

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

// FORK-MODIFICATION: 反馈 5（2026-10-15）——原来这里还有一个
// totalTaggedItemCount 专门喂给标题右侧的计数徽标，徽标去掉后就没有消费方了，
// 整段删除而不是留着当死代码。
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

// FORK-MODIFICATION: 反馈 5a（2026-10-15）—— 默认展开「收藏夹」「已标记」，
// 默认收起「常用」「历史」。
// 原来四个分组都是「有内容就展开」，面板一打开就被常用 100 条 + 历史 100 条
// 拉成一长串，真正随手要点的收藏夹/已标记反而挤在折叠线之上。
// `openStates` 仍只在用户手动切换后才接管，手动折叠的偏好不受这次改动影响。
const favoritesOpen = useSectionOpenState('favorites', () => true);

const tagsOpen = useSectionOpenState('tagged', () => true);

const frequentOpen = useSectionOpenState('frequent', () => false);

const historyOpen = useSectionOpenState('history', () => false);

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

// FORK-MODIFICATION: 反馈 5（2026-10-15）——分组之后，拖拽换位必须**限定在组内**。
// 直接 setFavorites(nextItems) 会把别的组的条目一起顶掉：侧边栏的分组是按
// 「favoriteCategories 的顺序 + 未分类」拼出来的，而 favorites 是**一个扁平数组**，
// 组内重排只能靠 reorderMatchingItems 把「出现在 nextItems 里的那批 path」
// 原地替换回扁平列表的对应位置——和下面 handleTaggedItemsReorder 同一套路。
function handleFavoriteGroupReorder(nextItems: FavoriteItem[]) {
  userStatsStore.setFavorites(reorderMatchingItems(
    favoriteItems.value,
    nextItems,
    item => item.path,
  ));
}

function handleTaggedItemsReorder(nextItems: TaggedItem[]) {
  userStatsStore.setTaggedItems(reorderMatchingItems(
    taggedItems.value,
    nextItems,
    item => item.path,
  ));
}

// FORK-MODIFICATION: 需求 N3⑤（决策 D4）——点各分组标题右侧的箭头时切到
// 仪表盘对应页签。先跳到仪表盘路由，再设 activeTab：
// 仪表盘页若尚未挂载，页内 setup 时的一次性读取会取到这个值；
// 若已挂载，由 `useRestoredActiveTab` 里新增的反向 watch 接住（否则点了没反应）。
// 四个 id 与 dashboard.vue 的 TabsTrigger value 一一对应：favorites/tagged/
// frequent/history，别的地方要跳页签也走这里，别自己拼字符串。
type DashboardTabId = 'favorites' | 'tagged' | 'frequent' | 'history';

function openDashboardTab(tab: DashboardTabId) {
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
            <!-- FORK-MODIFICATION: 需求 N3⑤（决策 D4）——标题右侧的箭头切到
                 仪表盘对应页签。四个分组一视同仁：收藏夹/已标记/常用/历史。 -->
            <QuickAccessSection
              v-if="sectionId === 'favorites'"
              v-model:open="favoritesOpen"
              :icon="StarIcon"
              :title="t('quickAccess.favorites')"
              :empty-text="t('quickAccess.emptyFavorites')"
              :is-empty="favoriteItems.length === 0"
            >
              <template #header-action>
                <button
                  type="button"
                  class="quick-access-panel__section-action"
                  :title="t('quickAccess.openFavoritesTab')"
                  @click.stop="openDashboardTab('favorites')"
                >
                  <ArrowRightIcon :size="14" />
                </button>
              </template>
              <!-- FORK-MODIFICATION: 反馈 5（2026-10-15）——按分类分组渲染。
                   分组标题不给计数，与去掉的四个分组计数徽标保持一致。 -->
              <div
                v-for="group in favoriteGroups"
                :key="group.key"
                class="quick-access-panel__tag-group quick-access-panel__subgroup"
              >
                <div class="quick-access-panel__tag-subtitle quick-access-panel__subgroup-subtitle">
                  <FolderIcon
                    :size="12"
                    class="quick-access-panel__category-icon"
                  />
                  <span class="quick-access-panel__tag-name">
                    {{ group.category?.name ?? t('dashboard.actions.uncategorized') }}
                  </span>
                </div>
                <div class="quick-access-panel__subgroup-items">
                  <SortableList
                    :items="group.items"
                    :get-key="getItemKey"
                    @set="handleFavoriteGroupReorder"
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
                </div>
              </div>
            </QuickAccessSection>

            <QuickAccessSection
              v-else-if="sectionId === 'tagged'"
              v-model:open="tagsOpen"
              :icon="TagIcon"
              :title="t('quickAccess.tagged')"
              :empty-text="t('quickAccess.emptyTagged')"
              :is-empty="!hasTaggedSectionContent"
            >
              <template #header-action>
                <button
                  type="button"
                  class="quick-access-panel__section-action"
                  :title="t('quickAccess.openTaggedTab')"
                  @click.stop="openDashboardTab('tagged')"
                >
                  <ArrowRightIcon :size="14" />
                </button>
              </template>
              <div
                v-for="group in tagGroups"
                :key="group.tag.id"
                class="quick-access-panel__tag-group quick-access-panel__subgroup"
              >
                <div class="quick-access-panel__tag-subtitle quick-access-panel__subgroup-subtitle">
                  <span
                    class="quick-access-panel__tag-dot"
                    :style="{ backgroundColor: group.tag.color }"
                  />
                  <span class="quick-access-panel__tag-name">{{ group.tag.name }}</span>
                </div>
                <div class="quick-access-panel__subgroup-items">
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
              </div>
              <div
                v-if="orphanedTaggedItems.length > 0"
                class="quick-access-panel__tag-group quick-access-panel__subgroup"
              >
                <div class="quick-access-panel__tag-subtitle quick-access-panel__subgroup-subtitle">
                  <span class="quick-access-panel__tag-dot quick-access-panel__tag-dot--muted" />
                  <span class="quick-access-panel__tag-name">{{ t('quickAccess.unknownTagGroup') }}</span>
                </div>
                <div class="quick-access-panel__subgroup-items">
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
              </div>
            </QuickAccessSection>

            <!-- FORK-MODIFICATION: 需求 N3②⑤ —— 「常用」分组。
                 标题右侧的按钮跳到仪表盘「常用」页签（决策 D4）。 -->
            <QuickAccessSection
              v-else-if="sectionId === 'frequent'"
              v-model:open="frequentOpen"
              :icon="TrendingUpIcon"
              :title="t('quickAccess.frequent')"
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

/* FORK-MODIFICATION: 反馈 6（2026-10-15）——分类 / 标记分组与其下条目的层级区分。

   之前分组标题和它下面的条目左对齐、字号接近，扫一眼分不出谁属于谁；
   分类标题又是个和收藏条目同款的灰色文件夹图标，混淆得更彻底。

   三个信号叠在一起，任一单独都不够：
     * 上间距 —— 分组之间断开，不看样式也知道「这里换了一个组」；
     * 圆角浅灰底 —— 标题读起来是**一条带子**而不是一个可点条目；
     * 条目缩进 + 左侧竖线 —— 文件树式的父子关系，最直接的归属线索。

   收藏按分类、标记按 tag 是同一个概念，所以两处共用这组类，
   避免面板里出现两套层级语言。 */
.quick-access-panel__subgroup {
  margin-top: 10px;
}

.quick-access-panel__subgroup-subtitle {
  border-radius: var(--radius-sm);
  background-color: hsl(var(--foreground) / 5%);
  padding-inline: 8px;
}

.quick-access-panel__subgroup-items {
  margin-inline-start: 10px;
  padding-inline-start: 8px;
  border-inline-start: 1px solid hsl(var(--foreground) / 12%);
}

/* FORK-MODIFICATION: 反馈 5（2026-10-15）——收藏分组标题前的文件夹图标。
   不能复用 __tag-dot：那个类给标记用的是**背景色圆点**，靠 inline
   backgroundColor 上色；分类这里要的是描边图标，得走 color。
   刻意用主色，和收藏条目自己的灰图标拉开距离。 */
.quick-access-panel__category-icon {
  flex-shrink: 0;
  color: hsl(var(--primary));
}
</style>
