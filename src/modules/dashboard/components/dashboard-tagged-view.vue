<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowUpDownIcon,
  LayoutGridIcon,
  ListIcon,
  Trash2Icon,
} from '@lucide/vue';
import { DirEntryInteractive } from '@/components/dir-entry-interactive';
import { SortableList } from '@/components/sortable-list';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ItemTagsField } from '@/components/ui/tag-selector';
import { useRestoredActiveTab, useRestoredChoice } from '@/composables/use-restored-active-tab';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { getPathDisplayName } from '@/utils/normalize-path';
import { haveSameKeyOrder, reorderMatchingItems } from '@/utils/reorder-matching-items';
import {
  DASHBOARD_CARD_ENTRANCE,
  getDashboardContentEntranceBinding,
  getStaggerSlideUpBinding,
} from '@/utils/stagger-animation';
import { pickRandomTagColor } from '@/utils/tag-colors';
import { TAGGED_ITEM_SORT_MODES, sortTaggedItems } from '@/utils/tagged-item-sort';
import { TAGGED_ITEM_TYPE_FILTERS, filterTaggedItemsByType } from '@/utils/tagged-item-type-filter';
import { getDashboardTagSections, resolveSelectedTagId } from '@/utils/tagged-sections';
import type { TaggedItem } from '@/types/user-stats';
import DashboardActionBar from '@/modules/dashboard/components/dashboard-action-bar.vue';
import DashboardConfirmDialog from '@/modules/dashboard/components/dashboard-confirm-dialog.vue';
import DashboardEmptyState from '@/modules/dashboard/components/dashboard-empty-state.vue';
import DashboardOpenFolderButton from '@/modules/dashboard/components/dashboard-open-folder-button.vue';
import DashboardTagSidebar from '@/modules/dashboard/components/dashboard-tag-sidebar.vue';
import DashboardTaggedItemMeta from '@/modules/dashboard/components/dashboard-tagged-item-meta.vue';
import DashboardTypeFilter from '@/modules/dashboard/components/dashboard-type-filter.vue';
import EntryCard from '@/modules/dashboard/components/entry-card.vue';
import { useDashboardItemOpener } from '@/modules/dashboard/composables/use-dashboard-item-opener';
import { useDashboardItemSizes } from '@/modules/dashboard/composables/use-dashboard-item-sizes';

const ITEM_LAYOUTS = ['list', 'grid'] as const;

const { t } = useI18n();
const dashboardContentEntrance = getDashboardContentEntranceBinding();
const route = useRoute();
const router = useRouter();
const userStatsStore = useUserStatsStore();
const { openItem } = useDashboardItemOpener();

const preferredTagId = useRestoredActiveTab('dashboard-tagged-tag', '');
const sortMode = useRestoredChoice('dashboard-tagged-sort', TAGGED_ITEM_SORT_MODES, 'custom');
const itemLayout = useRestoredChoice('dashboard-tagged-layout', ITEM_LAYOUTS, 'list');
const typeFilter = useRestoredChoice('dashboard-tagged-type-filter', TAGGED_ITEM_TYPE_FILTERS, 'all');
const activeTagSelectorPath = ref<string | null>(null);
const isClearAllConfirmOpen = ref(false);

const taggedItems = computed(() => userStatsStore.taggedItems);
const tags = computed(() => userStatsStore.tags);
const sections = computed(() => {
  return getDashboardTagSections(
    tags.value,
    taggedItems.value,
    t('quickAccess.unknownTagGroup'),
  );
});
const selectedTagId = computed(() => {
  return resolveSelectedTagId(
    sections.value.map(section => section.tag.id),
    preferredTagId.value,
  );
});
const selectedSection = computed(() => {
  return sections.value.find(section => section.tag.id === selectedTagId.value) ?? null;
});
const hasAnyTaggedContent = computed(() => {
  return tags.value.length > 0 || taggedItems.value.length > 0;
});
const itemListKey = computed(() => `${selectedTagId.value}:${typeFilter.value}`);
const visibleItems = computed(() => {
  return sortTaggedItems(
    filterTaggedItemsByType(selectedSection.value?.items ?? [], typeFilter.value),
    sortMode.value,
    item => getPathDisplayName(item.path, t),
  );
});
const { getSizeLabel } = useDashboardItemSizes(visibleItems);

watch(selectedTagId, (tagId) => {
  activeTagSelectorPath.value = null;

  if (tagId && tagId !== preferredTagId.value) {
    preferredTagId.value = tagId;
  }
}, { immediate: true });

watch(
  () => route.query.tag,
  (tagQuery) => {
    if (typeof tagQuery === 'string' && tagQuery) {
      preferredTagId.value = tagQuery;
    }
  },
  { immediate: true },
);

function selectTag(tagId: string) {
  preferredTagId.value = tagId;
}

function getItemKey(item: TaggedItem): string {
  return item.path;
}

async function handleItemsReorder(nextItems: TaggedItem[]) {
  const nextTaggedItems = reorderMatchingItems(
    taggedItems.value,
    nextItems,
    item => item.path,
  );

  if (haveSameKeyOrder(taggedItems.value, nextTaggedItems, item => item.path)) {
    return;
  }

  await userStatsStore.setTaggedItems(nextTaggedItems);
}

function isTagSelectorActive(itemPath: string): boolean {
  return activeTagSelectorPath.value === itemPath;
}

function openEntryTagSelector(itemPath: string) {
  activeTagSelectorPath.value = itemPath;
}

function handleEntryTagsOpenChange(itemPath: string, open: boolean) {
  if (!open && activeTagSelectorPath.value === itemPath) {
    activeTagSelectorPath.value = null;
  }
}

function openNavigatorToTagItems() {
  router.push({ name: 'navigator' });
}

async function handleToggleTagOnItem(item: TaggedItem, tagId: string) {
  if (item.tagIds.includes(tagId)) {
    await userStatsStore.removeTagFromItem(item.path, tagId);
    return;
  }

  await userStatsStore.addTagToItem(item.path, tagId, item.isFile);
}

async function handleCreateTagForItem(item: TaggedItem, name: string) {
  const newTag = await userStatsStore.createTag(name, pickRandomTagColor());
  await userStatsStore.addTagToItem(item.path, newTag.id, item.isFile);
}
</script>

<template>
  <DashboardActionBar
    :title="t('dashboard.tabs.tagged')"
    :is-empty="!hasAnyTaggedContent"
    @clear-all="userStatsStore.clearAllTagged"
  >
    <template
      v-if="hasAnyTaggedContent"
      #filters
    >
      <DashboardTypeFilter v-model="typeFilter" />
    </template>
    <template
      v-if="hasAnyTaggedContent"
      #right
    >
      <Tabs
        v-model="itemLayout"
        class="dashboard-tagged-view__layout"
      >
        <TabsList class="dashboard-tagged-view__layout-list">
          <TabsTrigger
            value="list"
            class="dashboard-tagged-view__layout-trigger"
            :aria-label="t('listLayout')"
          >
            <ListIcon :size="16" />
          </TabsTrigger>
          <TabsTrigger
            value="grid"
            class="dashboard-tagged-view__layout-trigger"
            :aria-label="t('gridLayout')"
          >
            <LayoutGridIcon :size="16" />
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Select v-model="sortMode">
        <SelectTrigger class="dashboard-tagged-view__sort">
          <ArrowUpDownIcon
            :size="14"
            class="dashboard-tagged-view__sort-icon"
          />
          <SelectValue :placeholder="t('dashboard.sort.label')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="mode in TAGGED_ITEM_SORT_MODES"
            :key="mode"
            :value="mode"
          >
            {{ t(`dashboard.sort.${mode}`) }}
          </SelectItem>
        </SelectContent>
      </Select>
    </template>
    <template
      v-if="hasAnyTaggedContent"
      #menu
    >
      <DropdownMenuItem
        :disabled="taggedItems.length === 0"
        class="dashboard-action-bar__menu-item dashboard-action-bar__menu-item--destructive"
        @click="isClearAllConfirmOpen = true"
      >
        <Trash2Icon :size="14" />
        <span>{{ t('dashboard.actions.removeAllTags') }}</span>
      </DropdownMenuItem>
    </template>
  </DashboardActionBar>
  <DashboardEmptyState
    v-if="!hasAnyTaggedContent"
    v-bind="dashboardContentEntrance"
    type="tagged"
    :title="t('dashboard.emptyTagged')"
    :description="t('dashboard.emptyTaggedDescription')"
  >
    <template #footer>
      <Button
        variant="secondary"
        size="sm"
        @click="openNavigatorToTagItems"
      >
        {{ t('dashboard.tagItems') }}
      </Button>
    </template>
  </DashboardEmptyState>
  <div
    v-else
    v-bind="dashboardContentEntrance"
    class="dashboard-tagged-view"
  >
    <DashboardTagSidebar
      :sections="sections"
      :selected-tag-id="selectedTagId"
      @select="selectTag"
    />
    <div
      v-if="selectedSection"
      class="dashboard-tagged-view__content"
    >
      <DashboardEmptyState
        v-if="selectedSection.items.length === 0"
        type="tagged"
        :title="t('dashboard.emptyTagItems')"
      >
        <template #footer>
          <Button
            variant="secondary"
            size="sm"
            @click="openNavigatorToTagItems"
          >
            {{ t('dashboard.tagItems') }}
          </Button>
        </template>
      </DashboardEmptyState>
      <DashboardEmptyState
        v-else-if="visibleItems.length === 0"
        type="tagged"
        :title="t('fileBrowser.noMatchingItems')"
      >
        <template #footer>
          <Button
            variant="secondary"
            size="sm"
            @click="typeFilter = 'all'"
          >
            {{ t('dashboard.typeFilter.showAll') }}
          </Button>
        </template>
      </DashboardEmptyState>
      <SortableList
        v-else
        :key="itemListKey"
        class="dashboard-tagged-view__items"
        :class="{ 'dashboard-tagged-view__items--grid': itemLayout === 'grid' }"
        :items="visibleItems"
        :get-key="getItemKey"
        :disabled="sortMode !== 'custom'"
        @set="handleItemsReorder"
      >
        <template #item="{ item, index, ghost }">
          <DirEntryInteractive
            :path="item.path"
            :is-file="item.isFile"
          >
            <EntryCard
              v-bind="ghost ? {} : getStaggerSlideUpBinding(index, DASHBOARD_CARD_ENTRANCE)"
              :path="item.path"
              :is-file="item.isFile"
              :size-label="getSizeLabel(item.path)"
              :layout="itemLayout"
              @click="openItem(item.path, item.isFile)"
            >
              <template #actions>
                <DashboardOpenFolderButton :path="item.path" />
              </template>
              <template #meta>
                <DashboardTaggedItemMeta :item="item" />
              </template>
              <template #details>
                <ItemTagsField
                  align="start"
                  :tags="tags"
                  :selected-tag-ids="item.tagIds"
                  :is-selector-mounted="isTagSelectorActive(item.path)"
                  @open="openEntryTagSelector(item.path)"
                  @open-change="open => handleEntryTagsOpenChange(item.path, open)"
                  @toggle-tag="(tagId) => handleToggleTagOnItem(item, tagId)"
                  @create-tag="(name) => handleCreateTagForItem(item, name)"
                  @rename-tag="userStatsStore.renameTag"
                  @update-tag-color="userStatsStore.updateTagColor"
                  @reorder-tags="userStatsStore.setTags"
                />
              </template>
            </EntryCard>
          </DirEntryInteractive>
        </template>
      </SortableList>
    </div>
  </div>
  <DashboardConfirmDialog
    v-model:open="isClearAllConfirmOpen"
    :title="t('dashboard.actions.removeAllTagsConfirmTitle')"
    :description="t('dashboard.actions.removeAllTagsConfirmDescription')"
    @confirm="userStatsStore.clearAllTagged"
  />
</template>

<style>
.dashboard-tagged-view {
  display: grid;
  align-items: start;
  gap: 24px;
  grid-template-columns: 300px minmax(0, 1fr);
}

.dashboard-tagged-view__sort.sigma-ui-select-trigger {
  width: auto;
  min-width: 8rem;
  height: 2.25rem;
  justify-content: flex-start;
  padding: 0 0.75rem;
  font-size: 0.8125rem;
  gap: 8px;
  line-height: 1;
}

.dashboard-tagged-view__sort-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.dashboard-tagged-view__sort.sigma-ui-select-trigger .sigma-ui-select-trigger__icon {
  width: 0.75rem;
  height: 0.75rem;
  margin-left: auto;
}

.dashboard-tagged-view__layout-list.sigma-ui-tabs-list {
  height: 2.25rem;
  padding: 3px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  gap: 2px;
}

.dashboard-tagged-view__layout-trigger.sigma-ui-tabs-trigger {
  width: 2.25rem;
  flex: 0 0 auto;
  padding: 0;
}

.dashboard-tagged-view__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.dashboard-tagged-view__items .sortable-list__items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dashboard-tagged-view__items--grid .sortable-list__items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

.dashboard-tagged-view__items--grid .sortable-list__item,
.dashboard-tagged-view__items--grid .dir-entry-interactive,
.dashboard-tagged-view__items--grid .entry-card {
  height: 100%;
}

.dashboard-tagged-view__items .entry-card--list {
  align-items: flex-start;
}

.dashboard-tagged-view__items .entry-card--list .entry-card__actions {
  margin-top: -3px;
}

.dashboard-tagged-view__items .entry-card__icon {
  width: 64px;
  height: 64px;
}

.dashboard-tagged-view__items .entry-card__system-icon,
.dashboard-tagged-view__items .entry-card__icon svg {
  width: 40px;
  height: 40px;
}

.dashboard-tagged-view__items .entry-card--grid .entry-card__icon {
  width: 48px;
  height: 48px;
}

.dashboard-tagged-view__items .entry-card--grid .entry-card__system-icon,
.dashboard-tagged-view__items .entry-card--grid .entry-card__icon svg {
  width: 32px;
  height: 32px;
}

.dashboard-tagged-view__items .item-tags-field__static,
.dashboard-tagged-view__items .item-tags-field .tag-selector__trigger {
  gap: 8px;
}

.dashboard-tagged-view__items .item-tags-field {
  height: auto;
  min-height: 22px;
}

.dashboard-tagged-view__items .tag-selector__badge {
  height: 22px;
}

.dashboard-tagged-view__items .dir-entry-interactive {
  border-radius: var(--radius);
  transition:
    outline-color var(--hover-transition-duration-out) var(--hover-transition-easing-out),
    background-color var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.dashboard-tagged-view__items .dir-entry-interactive[data-drag-over] {
  background-color: var(--drop-target-subtle-background);
  outline: var(--drop-target-outline);
  outline-offset: var(--drop-target-outline-offset);
  transition:
    outline-color var(--hover-transition-duration-in),
    background-color var(--hover-transition-duration-in);
}

@media (width <= 768px) {
  .dashboard-tagged-view {
    gap: 16px;
    grid-template-columns: 1fr;
  }
}
</style>
