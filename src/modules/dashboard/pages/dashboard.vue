<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  FolderPlusIcon,
  StarIcon,
  TagIcon,
  TrendingUpIcon,
  ClockIcon,
  XIcon,
} from '@lucide/vue';
import { PageDefaultLayout } from '@/layouts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DirEntryInteractive } from '@/components/dir-entry-interactive';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { usePageDropZone } from '@/composables/use-page-drop-zone';
import { useRestoredActiveTab } from '@/composables/use-restored-active-tab';
import { useFileDropOperation } from '@/composables/use-file-drop-operation';
import { openNavigatorNavigablePath } from '@/utils/open-navigator-directory';
import { isVirtualLocationPath } from '@/utils/virtual-locations';
import DashboardActionBar from '@/modules/dashboard/components/dashboard-action-bar.vue';
import DashboardEmptyState from '@/modules/dashboard/components/dashboard-empty-state.vue';
// FORK-MODIFICATION 2026-10-23：Hero 顶部区（移植自 upstream `3eca4c17`）。
import DashboardHero from '@/modules/dashboard/components/dashboard-hero.vue';
import DashboardTagSectionHeader from '@/modules/dashboard/components/dashboard-tag-section-header.vue';
// FORK-MODIFICATION: 需求反馈 4（2026-10-15）——收藏/标记的新建与编辑入口。
import DashboardCategorySectionHeader from '@/modules/dashboard/components/dashboard-category-section-header.vue';
import DashboardEntryActionsMenu from '@/modules/dashboard/components/dashboard-entry-actions-menu.vue';
import DashboardNameDialog from '@/modules/dashboard/components/dashboard-name-dialog.vue';
import DashboardNewFavoriteDialog from '@/modules/dashboard/components/dashboard-new-favorite-dialog.vue';
import EntryCard from '@/modules/dashboard/components/entry-card.vue';
import EntryCardTags from '@/modules/dashboard/components/entry-card-tags.vue';
// FORK-MODIFICATION 2026-10-23：移植 upstream `3eca4c17` 的「给现有卡片加信息」四项。
// 这里只动信息层，不换页面骨架：标签页、分类分组、条目卡片结构全部保持原样。
import DashboardTaggedItemMeta from '@/modules/dashboard/components/dashboard-tagged-item-meta.vue';
import DashboardConfirmDialog from '@/modules/dashboard/components/dashboard-confirm-dialog.vue';
import { provideDashboardEntryPreviews } from '@/modules/dashboard/composables/use-dashboard-entry-previews';
import {
  useDashboardItemSizes,
  type DashboardSizedItem,
} from '@/modules/dashboard/composables/use-dashboard-item-sizes';
import { formatDashboardRelativeTime } from '@/utils/dashboard-relative-time';
import FileBrowserConflictDialog from '@/modules/navigator/components/file-browser/file-browser-conflict-dialog.vue';
import FileBrowserTopLevelConflictDialog from '@/modules/navigator/components/file-browser/file-browser-top-level-conflict-dialog.vue';
import type {
  FavoriteCategory,
  FavoriteItem,
  HistoryItem,
  FrequentItem,
  ItemTag,
  TaggedItem,
} from '@/types/user-stats';
import { getStaggerSlideUpBinding } from '@/utils/stagger-animation';
// FORK-MODIFICATION 2026-10-23：标签分组逻辑与色板抽成纯模块（移植自 upstream `3eca4c17`）。
// 原来色板在这个文件里抄了两份（下面一份常量、一份数组字面量），迟早漂移。
import { getTaggedSections, type TaggedSection } from '@/utils/tagged-sections';
import { pickRandomTagColor, TAG_COLORS } from '@/utils/tag-colors';

type ActiveTagSelector = {
  sectionTagId: string;
  itemPath: string;
};

// FORK-MODIFICATION 2026-10-23：分组本体来自 `@/utils/tagged-sections` 的纯函数，
// 这里只加一个本仓特有的 `staggerBase`（错落入场动画的起始序号）。
type DashboardTaggedSection = TaggedSection & {
  staggerBase: number;
};

// FORK-MODIFICATION: 反馈 4 —— 收藏按分类分组显示。
// 「未分类」是一个**虚拟分组**：category 为 null，没有可改名/删除的实体，
// 所以它的标题不渲染编辑按钮。
type FavoriteSection = {
  key: string;
  category: FavoriteCategory | null;
  items: FavoriteItem[];
  staggerBase: number;
};

const { t } = useI18n();
const router = useRouter();
const userStatsStore = useUserStatsStore();

const activeTab = useRestoredActiveTab('dashboard', 'favorites');
const dropContainerRef = ref<HTMLElement | null>(null);
const activeTagSelector = ref<ActiveTagSelector | null>(null);

const {
  conflictDialogState,
  handleConflictResolution,
  handleConflictCancel,
  topLevelNameConflictDialogState,
  handleTopLevelNameConflictRename,
  handleTopLevelNameConflictMerge,
  handleTopLevelNameConflictCancel,
  performDrop,
} = useFileDropOperation();

usePageDropZone({
  containerRef: dropContainerRef,
  onDrop: (sourcePaths, targetPath, operation) => {
    performDrop(sourcePaths, targetPath, operation);
  },
});

const favoriteItems = computed(() => userStatsStore.favorites);
const favoriteCategories = computed(() => userStatsStore.favoriteCategories);
const taggedItems = computed(() => userStatsStore.taggedItems);
const historyItems = computed(() => userStatsStore.sortedHistory);
const frequentItems = computed(() => userStatsStore.sortedFrequentItems);
const tags = computed(() => userStatsStore.tags);

// FORK-MODIFICATION 2026-10-23：缩略图助手在**页面级** provide，
// 几十张卡片共用一套缩略图缓存 —— 每张卡片各建一个 composable
// 会让同一个文件被重复解码、重复占内存。
provideDashboardEntryPreviews();

// 只统计**当前页签**的条目大小。四个页签的条目合起来可能几百条，
// 一次性全部 stat 会把界面卡住；切页签时 watch 会自动重新取，
// 目录大小还有 `useDirSizesStore` 的全局缓存兜底。
const activeSizedItems = computed<DashboardSizedItem[]>(() => {
  switch (activeTab.value) {
    case 'tagged':
      return taggedItems.value.map(item => ({
        path: item.path,
        isFile: item.isFile,
      }));
    case 'frequent':
      return frequentItems.value.map(item => ({
        path: item.path,
        isFile: item.isFile,
      }));
    case 'history':
      return historyItems.value.map(item => ({
        path: item.path,
        isFile: item.isFile,
      }));
    default:
      return favoriteItems.value.map(item => ({
        path: item.path,
        isFile: isFavoriteFile(item),
      }));
  }
});

const { getSizeLabel } = useDashboardItemSizes(activeSizedItems);

// FORK-MODIFICATION 2026-10-23：破坏性操作先弹确认框。
// 收进来的口径（与 upstream 一致）：**批量**与**不可逆**的操作要确认；
// 可逆的不确认 ——
//   确认：清空收藏/标记/常用、删除标记、取消收藏、移除单个标记；
//   不确认：删除收藏分类（收藏会回到「未分类」，可逆）、
//           移除历史记录（重新访问就回来了，可逆）。
type ConfirmAction = {
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
};

const confirmDialogOpen = ref(false);
const pendingConfirmAction = ref<ConfirmAction | null>(null);

function requestConfirmation(action: ConfirmAction) {
  pendingConfirmAction.value = action;
  confirmDialogOpen.value = true;
}

async function handleConfirmAction() {
  const action = pendingConfirmAction.value;
  pendingConfirmAction.value = null;

  if (action) {
    await action.onConfirm();
  }
}

// FORK-MODIFICATION 2026-10-23：清空整个列表先弹确认框。
function requestClearFavorites() {
  requestConfirmation({
    title: t('dashboard.actions.clearAllConfirmTitle'),
    description: t('dashboard.actions.clearAllConfirmDescription'),
    onConfirm: () => userStatsStore.clearAllFavorites(),
  });
}

function requestClearTagged() {
  requestConfirmation({
    title: t('dashboard.actions.clearAllConfirmTitle'),
    description: t('dashboard.actions.clearAllConfirmDescription'),
    onConfirm: () => userStatsStore.clearAllTagged(),
  });
}

function requestClearFrequent() {
  requestConfirmation({
    title: t('dashboard.actions.clearAllConfirmTitle'),
    description: t('dashboard.actions.clearAllConfirmDescription'),
    onConfirm: () => userStatsStore.clearAllFrequent(),
  });
}

function requestClearHistory() {
  requestConfirmation({
    title: t('dashboard.actions.clearAllConfirmTitle'),
    description: t('dashboard.actions.clearAllConfirmDescription'),
    onConfirm: () => userStatsStore.clearHistory(),
  });
}

// FORK-MODIFICATION: 反馈 4 —— 对话框状态。三种「新建」共用 name-dialog，
// 只有「新建收藏」因为需要路径输入而单独一个。
const newFavoriteDialogOpen = ref(false);
const newCategoryDialogOpen = ref(false);
const newTagDialogOpen = ref(false);
// 复用同一个 name-dialog 做「重命名分类」：标题与初值不同，交互完全一样。
const renameCategoryDialogOpen = ref(false);
const categoryBeingRenamed = ref<FavoriteCategory | null>(null);

// FORK-MODIFICATION 2026-10-23：色板改为引用 `@/utils/tag-colors` 里的唯一一份。
const TAG_COLOR_PALETTE = TAG_COLORS;

const categoryNameDraft = ref('');
const tagNameDraft = ref('');
const tagColorDraft = ref(TAG_COLOR_PALETTE[0]);

const categoryNameConflict = computed(() => {
  const draft = categoryNameDraft.value.trim().toLowerCase();
  const excludedId = categoryBeingRenamed.value?.id ?? null;

  if (!draft) {
    return null;
  }

  const clash = favoriteCategories.value.find(
    category => category.id !== excludedId && category.name.toLowerCase() === draft,
  );

  return clash ? clash.name : null;
});

const tagNameConflict = computed(() => {
  const draft = tagNameDraft.value.trim().toLowerCase();

  if (!draft) {
    return null;
  }

  const clash = tags.value.find(tag => tag.name.toLowerCase() === draft);
  return clash ? clash.name : null;
});

// 收藏分组：先按分类定义顺序输出（新建的分类排在最后），再补「未分类」。
// 分类被删掉后其下收藏回到 categoryId === null，不会凭空消失。
const favoriteSections = computed((): FavoriteSection[] => {
  let staggerBase = 0;
  const sections: FavoriteSection[] = [];

  for (const category of favoriteCategories.value) {
    const itemsForCategory = favoriteItems.value.filter(item => item.categoryId === category.id);

    // 空分类也要渲染分区头。跳过它的话，用户新建的分类在界面上完全不存在，
    // 于是既看不到自己建了什么，也没有任何入口能重命名或删除它 —— 只能靠
    // 「手滑建错了一个分类」这条永远走不通的路径。真机验收踩到过这个。
    sections.push({
      key: category.id,
      category,
      items: itemsForCategory,
      staggerBase,
    });

    staggerBase += itemsForCategory.length;
  }

  const uncategorized = favoriteItems.value.filter(item => !item.categoryId);

  if (uncategorized.length > 0) {
    sections.push({
      key: '__afm_uncategorized__',
      category: null,
      items: uncategorized,
      staggerBase,
    });
  }

  return sections;
});

// FORK-MODIFICATION 2026-10-23：分组交给纯函数 `getTaggedSections`，
// 这里只补上本仓特有的 `staggerBase`（错落入场动画的起始序号）。
const taggedSections = computed((): DashboardTaggedSection[] => {
  let staggerBase = 0;

  return getTaggedSections(tags.value, taggedItems.value).map((section) => {
    const staggered = {
      ...section,
      staggerBase,
    };
    staggerBase += section.items.length;
    return staggered;
  });
});

function isTagSelectorActive(sectionTagId: string, itemPath: string): boolean {
  return activeTagSelector.value?.sectionTagId === sectionTagId
    && activeTagSelector.value?.itemPath === itemPath;
}

function openEntryTagSelector(sectionTagId: string, itemPath: string) {
  activeTagSelector.value = {
    sectionTagId,
    itemPath,
  };
}

function handleEntryTagsOpenChange(sectionTagId: string, itemPath: string, open: boolean) {
  if (
    !open
    && activeTagSelector.value?.sectionTagId === sectionTagId
    && activeTagSelector.value?.itemPath === itemPath
  ) {
    activeTagSelector.value = null;
  }
}

function openItem(path: string, isFile: boolean) {
  openNavigatorNavigablePath(router, path, isFile);
}

// FORK-MODIFICATION: 反馈 4 —— 直接读 FavoriteItem.isFile。
// 原来是 `!item.path.endsWith('/') && item.path.includes('.')`，把
// `my.folder` 这类含点目录当成文件。isFile 由「新建收藏」时后端 stat 判定，
// 老记录由 store 读入时按同一规则补齐（user-stats store 的 normalizeFavorites），
// 所以这里不需要再兜底。
function isFavoriteFile(item: FavoriteItem): boolean {
  if (isVirtualLocationPath(item.path)) {
    return false;
  }

  return item.isFile;
}

// FORK-MODIFICATION 2026-10-23：相对时间改为复用纯模块
// `@/utils/dashboard-relative-time`（原来这里内联了一份，和新加的
// 「条目添加时间」是同一套逻辑，两处各写一遍迟早漂移）。
function formatRelativeTime(timestamp: number): string {
  return formatDashboardRelativeTime(timestamp, (key, count) => {
    return count === undefined ? t(key) : t(key, count);
  });
}

function openFavoriteItem(item: FavoriteItem) {
  openItem(item.path, isFavoriteFile(item));
}

function openHistoryItem(item: HistoryItem) {
  openItem(item.path, item.isFile);
}

function openFrequentItem(item: FrequentItem) {
  openItem(item.path, item.isFile);
}

// FORK-MODIFICATION 2026-10-23：取消收藏改成先弹确认框。
// 这个按钮是 AFM 特意保留的（upstream 把它删了且没补替代入口），
// 误点之后只能靠「记得路径」重新收藏 —— 代价对用户是实打实的。
function requestRemoveFavorite(path: string, event?: MouseEvent) {
  // 事件是可选的：卡片上的「取消收藏」既可能来自卡片按钮（带 MouseEvent），
  // 也可能来自 ⋮ 菜单项（无参数）。
  event?.stopPropagation();
  requestConfirmation({
    title: t('dashboard.actions.removeFavoriteConfirmTitle'),
    description: t('dashboard.actions.removeFavoriteConfirmDescription'),
    onConfirm: () => userStatsStore.removeFromFavorites(path),
  });
}

async function removeHistoryItem(path: string, openedAt: number, event: MouseEvent) {
  event.stopPropagation();
  await userStatsStore.removeFromHistory(path, openedAt);
}

async function handleToggleTagOnItem(item: TaggedItem, tagId: string) {
  const hasTag = item.tagIds.includes(tagId);

  if (hasTag) {
    await userStatsStore.removeTagFromItem(item.path, tagId);
  }
  else {
    await userStatsStore.addTagToItem(item.path, tagId, item.isFile);
  }
}

async function handleCreateTagForItem(item: TaggedItem, name: string) {
  const randomColor = pickRandomTagColor();
  const newTag = await userStatsStore.createTag(name, randomColor);

  await userStatsStore.addTagToItem(item.path, newTag.id, item.isFile);
}

// FORK-MODIFICATION 2026-10-23：删标记先弹确认框 —— 删标记会同时把所有条目上的
// tagId 剥掉，这一步是不可逆的。
function requestDeleteTag(tagId: string) {
  requestConfirmation({
    title: t('dashboard.actions.deleteTagConfirmTitle'),
    description: t('dashboard.actions.deleteTagConfirmDescription'),
    onConfirm: () => userStatsStore.deleteTag(tagId),
  });
}

async function handleRenameTag(tagId: string, name: string) {
  await userStatsStore.renameTag(tagId, name);
}

async function handleUpdateTagColor(tagId: string, color: string) {
  await userStatsStore.updateTagColor(tagId, color);
}

async function handleReorderTags(nextTags: ItemTag[]) {
  await userStatsStore.setTags(nextTags);
}

// ── 反馈 4：新建与编辑 ────────────────────────────────────────────────

// 上移/下移是否可用：只看在**当前分组**里的位置。
// 收藏和标记两个页签的分组结构不同（categoryId vs tagId），但这个判定一样，
// 所以抽成一个按「同一分组内的有序列表」工作的函数，避免两处各写一遍。
function canMoveWithinGroup<T extends { path: string }>(
  items: T[],
  path: string,
  direction: -1 | 1,
): boolean {
  const index = items.findIndex(item => item.path === path);

  if (index === -1) {
    return false;
  }

  return direction === -1 ? index > 0 : index < items.length - 1;
}

async function handleMoveFavorite(path: string, direction: -1 | 1) {
  await userStatsStore.moveFavoriteWithinCategory(path, direction);
}

async function handleMoveFavoriteToCategory(path: string, categoryId: string | null) {
  await userStatsStore.moveFavoriteToCategory(path, categoryId);
}

async function handleCreateFavorite(path: string, isFile: boolean, categoryId: string | null) {
  await userStatsStore.addToFavorites(path, isFile, categoryId);
}

function openNewCategoryDialog() {
  categoryNameDraft.value = '';
  newCategoryDialogOpen.value = true;
}

async function handleCreateCategory(name: string) {
  const created = await userStatsStore.createFavoriteCategory(name);

  if (!created) {
    return;
  }

  categoryNameDraft.value = created.name;
}

function openRenameCategoryDialog(category: FavoriteCategory) {
  categoryBeingRenamed.value = category;
  categoryNameDraft.value = category.name;
  renameCategoryDialogOpen.value = true;
}

async function handleRenameCategory(name: string) {
  const category = categoryBeingRenamed.value;

  if (!category) {
    return;
  }

  await userStatsStore.renameFavoriteCategory(category.id, name);
  categoryBeingRenamed.value = null;
}

// 删分类**不删收藏** —— 它们回到「未分类」。可逆，且不静默丢用户数据。
async function handleDeleteCategory(category: FavoriteCategory) {
  await userStatsStore.deleteFavoriteCategory(category.id);
}

function openNewTagDialog() {
  tagNameDraft.value = '';
  tagColorDraft.value = TAG_COLOR_PALETTE[Math.floor(Math.random() * TAG_COLOR_PALETTE.length)];
  newTagDialogOpen.value = true;
}

async function handleCreateTag(name: string, color: string) {
  await userStatsStore.createTag(name, color || tagColorDraft.value);
}

function getTagSectionIndex(tagId: string): number {
  return taggedSections.value.findIndex(section => section.tag.id === tagId);
}

function canMoveTag(tagId: string, direction: -1 | 1): boolean {
  const index = getTagSectionIndex(tagId);
  return direction === -1 ? index > 0 : index >= 0 && index < taggedSections.value.length - 1;
}

async function handleMoveTag(tagId: string, direction: -1 | 1) {
  const nextTags = [...tags.value];
  const index = nextTags.findIndex(tag => tag.id === tagId);
  const target = index + direction;

  if (index === -1 || target < 0 || target >= nextTags.length) {
    return;
  }

  const moved = nextTags[index];
  nextTags[index] = nextTags[target];
  nextTags[target] = moved;

  await userStatsStore.setTags(nextTags);
}

// 标记条目的排序：同分组内按数组顺序渲染（taggedSections 就是按 tagIds 过滤
// taggedItems 的结果），所以只要在 taggedItems 数组里把相邻两条换位。
async function handleMoveTaggedItem(section: TaggedSection, path: string, direction: -1 | 1) {
  const globalIndexes = section.items
    .map(item => taggedItems.value.findIndex(candidate => candidate.path === item.path))
    .filter(index => index !== -1);

  const position = section.items.findIndex(item => item.path === path);
  const targetPosition = position + direction;

  if (position === -1 || targetPosition < 0 || targetPosition >= globalIndexes.length) {
    return;
  }

  const nextItems = [...taggedItems.value];
  const from = globalIndexes[position];
  const to = globalIndexes[targetPosition];
  const moved = nextItems[from];

  nextItems[from] = nextItems[to];
  nextItems[to] = moved;

  await userStatsStore.setTaggedItems(nextItems);
}

// FORK-MODIFICATION 2026-10-23：移除单个标记先弹确认框。
function requestRemoveTaggedItem(item: TaggedItem, sectionTagId: string) {
  requestConfirmation({
    title: t('dashboard.actions.removeTagConfirmTitle'),
    description: t('dashboard.actions.removeTagConfirmDescription'),
    onConfirm: () => userStatsStore.removeTagFromItem(item.path, sectionTagId),
  });
}
</script>

<template>
  <PageDefaultLayout class="dashboard-page">
    <div ref="dropContainerRef">
      <Tabs
        v-model="activeTab"
        default-value="favorites"
        class="dashboard-page__tabs"
      >
        <!-- FORK-MODIFICATION 2026-10-23：Hero 顶部区（移植自 upstream `3eca4c17`）。
             页签从 Hero 外面挪进 Hero 底部，样式仍是本仓的胶囊页签 ——
             upstream 那个位置放的是四张大计数卡，本仓不能换。 -->
        <DashboardHero
          :title="t('pages.dashboard')"
          :subtitle="t('dashboard.subtitle')"
        >
          <TabsList class="dashboard-page__tabs-list">
            <TabsTrigger
              value="favorites"
              class="dashboard-page__tab-trigger"
            >
              <StarIcon :size="16" />
              <span>{{ t('dashboard.tabs.favorites') }}</span>
              <span
                v-if="favoriteItems.length > 0"
                class="dashboard-page__tab-badge"
              >
                {{ favoriteItems.length }}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="tagged"
              class="dashboard-page__tab-trigger"
            >
              <TagIcon :size="16" />
              <span>{{ t('dashboard.tabs.tagged') }}</span>
              <span
                v-if="taggedItems.length > 0"
                class="dashboard-page__tab-badge"
              >
                {{ taggedItems.length }}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="frequent"
              class="dashboard-page__tab-trigger"
            >
              <TrendingUpIcon :size="16" />
              <span>{{ t('dashboard.tabs.frequent') }}</span>
              <span
                v-if="frequentItems.length > 0"
                class="dashboard-page__tab-badge"
              >
                {{ frequentItems.length }}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              class="dashboard-page__tab-trigger"
            >
              <ClockIcon :size="16" />
              <span>{{ t('dashboard.tabs.history') }}</span>
              <span
                v-if="historyItems.length > 0"
                class="dashboard-page__tab-badge"
              >
                {{ historyItems.length }}
              </span>
            </TabsTrigger>
          </TabsList>
        </DashboardHero>

        <TabsContent
          value="favorites"
          class="dashboard-page__tab-content"
        >
          <DashboardActionBar
            :is-empty="favoriteItems.length === 0"
            @clear-all="requestClearFavorites()"
          >
            <template #menu-items>
              <DropdownMenuItem
                @click="newFavoriteDialogOpen = true"
              >
                <StarIcon :size="14" />
                <span>{{ t('dashboard.actions.newFavorite') }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                @click="openNewCategoryDialog()"
              >
                <FolderPlusIcon :size="14" />
                <span>{{ t('dashboard.actions.newCategory') }}</span>
              </DropdownMenuItem>
            </template>
          </DashboardActionBar>
          <DashboardEmptyState
            v-if="favoriteItems.length === 0"
            type="favorites"
            :title="t('dashboard.emptyFavorites')"
            :description="t('dashboard.emptyFavoritesDescription')"
          />
          <!-- FORK-MODIFICATION: 反馈 4 —— 收藏按分类分组显示，组内可排序、可改归属。 -->
          <div
            v-else
            class="dashboard-page__tagged-sections"
          >
            <section
              v-for="section in favoriteSections"
              :key="section.key"
              class="dashboard-page__tagged-section"
            >
              <div class="dashboard-page__tagged-section-head">
                <DashboardCategorySectionHeader
                  :name="section.category?.name ?? t('dashboard.actions.uncategorized')"
                  :count="section.items.length"
                  :category="section.category"
                  @rename-category="openRenameCategoryDialog"
                  @delete-category="handleDeleteCategory"
                />
              </div>
              <div class="dashboard-page__items-grid">
                <DirEntryInteractive
                  v-for="(item, itemIndex) in section.items"
                  :key="item.path"
                  :path="item.path"
                  :is-file="isFavoriteFile(item)"
                >
                  <EntryCard
                    v-bind="getStaggerSlideUpBinding(section.staggerBase + itemIndex)"
                    :path="item.path"
                    :is-file="isFavoriteFile(item)"
                    :size-label="getSizeLabel(item.path)"
                    @click="openFavoriteItem(item)"
                  >
                    <DashboardEntryActionsMenu
                      :can-move-up="canMoveWithinGroup(section.items, item.path, -1)"
                      :can-move-down="canMoveWithinGroup(section.items, item.path, 1)"
                      show-category-picker
                      :categories="favoriteCategories"
                      :current-category-id="item.categoryId"
                      :remove-label="t('dashboard.actions.removeFavorite')"
                      @move-up="handleMoveFavorite(item.path, -1)"
                      @move-down="handleMoveFavorite(item.path, 1)"
                      @move-to-category="categoryId => handleMoveFavoriteToCategory(item.path, categoryId)"
                      @remove="requestRemoveFavorite(item.path, $event)"
                    />
                    <!-- FORK-MODIFICATION 2026-10-23：类型 + 「添加于 X 前」 -->
                    <template #meta>
                      <DashboardTaggedItemMeta :item="item" />
                    </template>
                  </EntryCard>
                </DirEntryInteractive>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent
          value="tagged"
          class="dashboard-page__tab-content"
        >
          <DashboardActionBar
            :is-empty="taggedItems.length === 0"
            @clear-all="requestClearTagged()"
          >
            <template #menu-items>
              <DropdownMenuItem
                @click="openNewTagDialog()"
              >
                <TagIcon :size="14" />
                <span>{{ t('dashboard.actions.newTag') }}</span>
              </DropdownMenuItem>
            </template>
          </DashboardActionBar>
          <DashboardEmptyState
            v-if="taggedItems.length === 0"
            type="tagged"
            :title="t('dashboard.emptyTagged')"
            :description="t('dashboard.emptyTaggedDescription')"
          />
          <div
            v-else
            class="dashboard-page__tagged-sections"
          >
            <section
              v-for="section in taggedSections"
              :key="section.tag.id"
              class="dashboard-page__tagged-section"
            >
              <div class="dashboard-page__tagged-section-head">
                <DashboardTagSectionHeader
                  :tag="section.tag"
                  :can-move-up="canMoveTag(section.tag.id, -1)"
                  :can-move-down="canMoveTag(section.tag.id, 1)"
                  @rename-tag="handleRenameTag"
                  @delete-tag="requestDeleteTag"
                  @update-tag-color="handleUpdateTagColor"
                  @move-up="tagId => handleMoveTag(tagId, -1)"
                  @move-down="tagId => handleMoveTag(tagId, 1)"
                />
              </div>
              <div class="dashboard-page__items-grid">
                <DirEntryInteractive
                  v-for="(item, itemIndex) in section.items"
                  :key="`${section.tag.id}-${item.path}`"
                  :path="item.path"
                  :is-file="item.isFile"
                >
                  <EntryCard
                    v-bind="getStaggerSlideUpBinding(section.staggerBase + itemIndex)"
                    :path="item.path"
                    :is-file="item.isFile"
                    :size-label="getSizeLabel(item.path)"
                    @click="openItem(item.path, item.isFile)"
                  >
                    <template #footer>
                      <EntryCardTags
                        :item="item"
                        :tags="tags"
                        :is-selector-active="isTagSelectorActive(section.tag.id, item.path)"
                        @open="openEntryTagSelector(section.tag.id, item.path)"
                        @open-change="open => handleEntryTagsOpenChange(section.tag.id, item.path, open)"
                        @toggle-tag="(tagId) => handleToggleTagOnItem(item, tagId)"
                        @create-tag="(name) => handleCreateTagForItem(item, name)"
                        @rename-tag="handleRenameTag"
                        @update-tag-color="handleUpdateTagColor"
                        @reorder-tags="handleReorderTags"
                      />
                    </template>
                    <!-- FORK-MODIFICATION: 反馈 4 —— 组内排序与移除标记。 -->
                    <DashboardEntryActionsMenu
                      :can-move-up="canMoveWithinGroup(section.items, item.path, -1)"
                      :can-move-down="canMoveWithinGroup(section.items, item.path, 1)"
                      :remove-label="t('dashboard.actions.removeTag')"
                      @move-up="handleMoveTaggedItem(section, item.path, -1)"
                      @move-down="handleMoveTaggedItem(section, item.path, 1)"
                      @remove="requestRemoveTaggedItem(item, section.tag.id)"
                    />
                    <!-- FORK-MODIFICATION 2026-10-23：类型 + 「添加于 X 前」 -->
                    <template #meta>
                      <DashboardTaggedItemMeta :item="item" />
                    </template>
                  </EntryCard>
                </DirEntryInteractive>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent
          value="frequent"
          class="dashboard-page__tab-content"
        >
          <DashboardActionBar
            :is-empty="frequentItems.length === 0"
            @clear-all="requestClearFrequent()"
          />
          <DashboardEmptyState
            v-if="frequentItems.length === 0"
            type="frequent"
            :title="t('dashboard.emptyFrequent')"
            :description="t('dashboard.emptyFrequentDescription')"
          />
          <div
            v-else
            class="dashboard-page__items-grid"
          >
            <DirEntryInteractive
              v-for="(item, itemIndex) in frequentItems"
              :key="item.path"
              :path="item.path"
              :is-file="item.isFile"
            >
              <EntryCard
                v-bind="getStaggerSlideUpBinding(itemIndex)"
                :path="item.path"
                :is-file="item.isFile"
                :size-label="getSizeLabel(item.path)"
                @click="openFrequentItem(item)"
              >
                <div class="entry-card__stats">
                  <span class="entry-card__badge">{{ t('dashboard.openedCount', item.openCount) }}</span>
                </div>
              </EntryCard>
            </DirEntryInteractive>
          </div>
        </TabsContent>

        <TabsContent
          value="history"
          class="dashboard-page__tab-content"
        >
          <DashboardActionBar
            :is-empty="historyItems.length === 0"
            @clear-all="requestClearHistory()"
          />
          <DashboardEmptyState
            v-if="historyItems.length === 0"
            type="history"
            :title="t('dashboard.emptyHistory')"
            :description="t('dashboard.emptyHistoryDescription')"
          />
          <div
            v-else
            class="dashboard-page__items-grid"
          >
            <DirEntryInteractive
              v-for="(item, itemIndex) in historyItems"
              :key="`${item.path}-${item.openedAt}`"
              :path="item.path"
              :is-file="item.isFile"
            >
              <EntryCard
                v-bind="getStaggerSlideUpBinding(itemIndex)"
                :path="item.path"
                :is-file="item.isFile"
                :size-label="getSizeLabel(item.path)"
                @click="openHistoryItem(item)"
              >
                <span class="entry-card__time">{{ formatRelativeTime(item.openedAt) }}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  class="entry-card__action"
                  @click="removeHistoryItem(item.path, item.openedAt, $event)"
                >
                  <XIcon :size="14" />
                </Button>
              </EntryCard>
            </DirEntryInteractive>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    <FileBrowserConflictDialog
      v-model:open="conflictDialogState.isOpen"
      :conflicts="conflictDialogState.conflicts"
      :operation-type="conflictDialogState.operationType"
      :is-checking-conflicts="conflictDialogState.isCheckingConflicts"
      @resolve="handleConflictResolution"
      @cancel="handleConflictCancel"
    />
    <FileBrowserTopLevelConflictDialog
      v-model:open="topLevelNameConflictDialogState.isOpen"
      :conflicts="topLevelNameConflictDialogState.conflicts"
      @rename="handleTopLevelNameConflictRename"
      @merge="handleTopLevelNameConflictMerge"
      @cancel="handleTopLevelNameConflictCancel"
    />

    <!-- FORK-MODIFICATION: 反馈 4 —— 四个对话框。 -->
    <DashboardNewFavoriteDialog
      v-model:open="newFavoriteDialogOpen"
      :categories="favoriteCategories"
      :is-already-favorite="path => userStatsStore.isFavorite(path)"
      @confirm="handleCreateFavorite"
    />

    <DashboardNameDialog
      v-model:open="newCategoryDialogOpen"
      :title="t('dashboard.actions.newCategory')"
      :duplicate-of="categoryNameConflict"
      @confirm="(name) => handleCreateCategory(name)"
    />

    <DashboardNameDialog
      v-model:open="newTagDialogOpen"
      :title="t('dashboard.actions.newTag')"
      :initial-color="tagColorDraft"
      :duplicate-of="tagNameConflict"
      @confirm="handleCreateTag"
    />

    <DashboardNameDialog
      v-model:open="renameCategoryDialogOpen"
      :title="t('dashboard.actions.renameCategory')"
      :initial-name="categoryBeingRenamed?.name ?? ''"
      :duplicate-of="categoryNameConflict"
      @confirm="handleRenameCategory"
    />

    <!-- FORK-MODIFICATION 2026-10-23：破坏性操作的确认框。 -->
    <DashboardConfirmDialog
      v-model:open="confirmDialogOpen"
      :title="pendingConfirmAction?.title ?? ''"
      :description="pendingConfirmAction?.description ?? ''"
      @confirm="handleConfirmAction"
    />
  </PageDefaultLayout>
</template>

<style>
.dashboard-page__tabs {
  display: flex;
  flex-direction: column;
}

/* FORK-MODIFICATION 2026-10-23：页签挪进 Hero 之后改玻璃态 ——
   胶囊压在背景图上，半透明 + 背景模糊才读得清。
   `display` 从 flex 改回 inline-flex：胶囊块按内容宽度收缩，
   像一块浮在 Hero 底部的玻璃，而不是横贯一整行。 */
.dashboard-page__tabs-list {
  display: inline-flex;
  padding: 4px;
  border: 1px solid hsl(var(--border) / 70%);
  border-radius: var(--radius);
  background-color: hsl(var(--card) / 72%);
  backdrop-filter: blur(10px);
  gap: 4px;
}

.dashboard-page__tab-trigger {
  position: relative;
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 8px;
}

.dashboard-page__tab-badge {
  display: flex;
  min-width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-radius: 10px;
  background-color: hsl(var(--primary) / 20%);
  color: hsl(var(--primary));
  font-size: 11px;
  font-weight: 600;
}

.dashboard-page__tab-content {
  display: flex;
  flex-direction: column;
  animation: fade-in 0.2s ease-out;
  gap: 12px;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dashboard-page__tagged-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-page__tagged-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dashboard-page__tagged-section-head {
  min-width: 0;
}

.dashboard-page__tagged-section-head .tag-selector__tag-name {
  font-size: 0.9375rem;
  font-weight: 600;
}

.dashboard-page__items-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.dashboard-page__items-grid .dir-entry-interactive {
  border-radius: var(--radius);
  transition:
    outline-color var(--hover-transition-duration-out) var(--hover-transition-easing-out),
    background-color var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.dashboard-page__items-grid .dir-entry-interactive[data-drag-over] {
  background-color: var(--drop-target-subtle-background);
  outline: var(--drop-target-outline);
  outline-offset: var(--drop-target-outline-offset);
  transition:
    outline-color var(--hover-transition-duration-in),
    background-color var(--hover-transition-duration-in);
}

@media (width <= 768px) {
  .dashboard-page__tabs-list.sigma-ui-tabs-list {
    display: grid;
    height: auto;
    grid-template-columns: repeat(4, 1fr);
  }

  .dashboard-page__tab-trigger {
    flex-direction: column;
    padding: 8px;
    font-size: 0.75rem;
    gap: 4px;
  }

  .dashboard-page__tab-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 18px;
    height: 18px;
    font-size: 10px;
  }
}
</style>
