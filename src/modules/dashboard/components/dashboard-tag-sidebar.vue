<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CirclePlusIcon, SearchIcon } from '@lucide/vue';
import { SortableList } from '@/components/sortable-list';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { stopSpaceKeyPropagation } from '@/composables/use-tag-inline-editor';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { haveSameKeyOrder, reorderMatchingItems } from '@/utils/reorder-matching-items';
import { DASHBOARD_CARD_ENTRANCE, getStaggerSlideUpBinding } from '@/utils/stagger-animation';
import { pickRandomTagColor } from '@/utils/tag-colors';
import { isOrphanedTagId, type TaggedSection } from '@/utils/tagged-sections';
import DashboardConfirmDialog from '@/modules/dashboard/components/dashboard-confirm-dialog.vue';
import DashboardTagListItem from '@/modules/dashboard/components/dashboard-tag-list-item.vue';

const props = defineProps<{
  sections: TaggedSection[];
  selectedTagId: string | null;
}>();

const emit = defineEmits<{
  select: [tagId: string];
}>();

const { t } = useI18n();
const userStatsStore = useUserStatsStore();

const tagSearchQuery = ref('');
const isCreatingTag = ref(false);
const tagIdPendingDelete = ref<string | null>(null);
const isDeleteTagConfirmOpen = ref(false);

const trimmedTagSearchQuery = computed(() => tagSearchQuery.value.trim());
const matchingSections = computed(() => {
  const normalizedSearch = trimmedTagSearchQuery.value.toLowerCase();

  if (!normalizedSearch) {
    return props.sections;
  }

  return props.sections.filter(section => section.tag.name.toLowerCase().includes(normalizedSearch));
});
const sortableSections = computed(() => {
  return matchingSections.value.filter(section => !isOrphanedTagId(section.tag.id));
});
const orphanedSection = computed(() => {
  return matchingSections.value.find(section => isOrphanedTagId(section.tag.id)) ?? null;
});
const canCreateTag = computed(() => {
  const normalizedName = trimmedTagSearchQuery.value.toLowerCase();

  return normalizedName.length > 0
    && !userStatsStore.tags.some(tag => tag.name.toLowerCase() === normalizedName);
});

function getSectionKey(section: TaggedSection): string {
  return section.tag.id;
}

function clearTagSearch() {
  tagSearchQuery.value = '';
}

async function createTagFromSearch() {
  if (!canCreateTag.value || isCreatingTag.value) {
    return;
  }

  isCreatingTag.value = true;

  try {
    const newTag = await userStatsStore.createTag(trimmedTagSearchQuery.value, pickRandomTagColor());
    clearTagSearch();
    emit('select', newTag.id);
  }
  finally {
    isCreatingTag.value = false;
  }
}

async function handleTagsReorder(nextSections: TaggedSection[]) {
  const currentTags = userStatsStore.tags;
  const nextTags = reorderMatchingItems(
    currentTags,
    nextSections.map(section => section.tag),
    tag => tag.id,
  );

  if (haveSameKeyOrder(currentTags, nextTags, tag => tag.id)) {
    return;
  }

  await userStatsStore.setTags(nextTags);
}

function requestDeleteTag(tagId: string) {
  tagIdPendingDelete.value = tagId;
  isDeleteTagConfirmOpen.value = true;
}

async function confirmDeleteTag() {
  const tagId = tagIdPendingDelete.value;
  tagIdPendingDelete.value = null;

  if (tagId) {
    await userStatsStore.deleteTag(tagId);
  }
}
</script>

<template>
  <aside
    v-bind="getStaggerSlideUpBinding(0, DASHBOARD_CARD_ENTRANCE)"
    class="dashboard-tag-sidebar"
  >
    <div class="sigma-ui-command-input dashboard-tag-sidebar__search">
      <SearchIcon class="sigma-ui-command-input__icon" />
      <input
        v-model="tagSearchQuery"
        class="sigma-ui-command-input__field"
        :placeholder="t('tags.searchTags')"
        :aria-label="t('tags.searchTags')"
        @keydown="stopSpaceKeyPropagation"
        @keydown.esc.prevent="clearTagSearch"
        @keydown.enter.prevent="createTagFromSearch"
      >
    </div>
    <div
      v-if="canCreateTag"
      class="dashboard-tag-sidebar__create"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="dashboard-tag-sidebar__create-button"
        :disabled="isCreatingTag"
        @click="createTagFromSearch"
      >
        <CirclePlusIcon class="dashboard-tag-sidebar__create-icon" />
        {{ t('tags.createTag') }} "{{ trimmedTagSearchQuery }}"
      </Button>
    </div>
    <ScrollArea class="dashboard-tag-sidebar__scroll">
      <nav
        class="dashboard-tag-sidebar__list"
        :aria-label="t('tags.editTags')"
      >
        <SortableList
          :items="sortableSections"
          :get-key="getSectionKey"
          handle-selector=".dashboard-tag-list-item__drag-handle"
          @set="handleTagsReorder"
        >
          <template #item="{ item: section, index, ghost }">
            <DashboardTagListItem
              v-bind="ghost ? {} : getStaggerSlideUpBinding(index, DASHBOARD_CARD_ENTRANCE)"
              :tag="section.tag"
              :count="section.items.length"
              :selected="section.tag.id === selectedTagId"
              @select="emit('select', section.tag.id)"
              @rename-tag="userStatsStore.renameTag"
              @delete-tag="requestDeleteTag"
              @update-tag-color="userStatsStore.updateTagColor"
            />
          </template>
        </SortableList>
        <DashboardTagListItem
          v-if="orphanedSection"
          v-bind="getStaggerSlideUpBinding(sortableSections.length, DASHBOARD_CARD_ENTRANCE)"
          :tag="orphanedSection.tag"
          :count="orphanedSection.items.length"
          :selected="orphanedSection.tag.id === selectedTagId"
          orphaned
          @select="emit('select', orphanedSection.tag.id)"
        />
      </nav>
    </ScrollArea>
    <DashboardConfirmDialog
      v-model:open="isDeleteTagConfirmOpen"
      :title="t('dashboard.actions.deleteTagConfirmTitle')"
      :description="t('dashboard.actions.deleteTagConfirmDescription')"
      @confirm="confirmDeleteTag"
    />
  </aside>
</template>

<style>
.dashboard-tag-sidebar {
  position: sticky;
  top: 0;
  display: flex;
  overflow: hidden;
  min-width: 0;
  max-height: calc(100vh - var(--window-toolbar-height));
  flex-direction: column;
  align-self: start;
  padding: 0;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
}

.dashboard-tag-sidebar.animate-stagger-slide-up {
  animation-name: animate-dashboard-sidebar-slide-up;
}

@keyframes animate-dashboard-sidebar-slide-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-tag-sidebar.animate-stagger-slide-up {
    animation: none;
    opacity: 1;
    transform: none;
  }
}

.dashboard-tag-sidebar__search.sigma-ui-command-input {
  flex-shrink: 0;
}

.dashboard-tag-sidebar__create {
  flex-shrink: 0;
  padding: 8px;
}

.dashboard-tag-sidebar__create-button.sigma-ui-button {
  width: 100%;
  height: auto;
  min-height: 2rem;
  justify-content: flex-start;
  gap: 8px;
  text-align: start;
  white-space: normal;
}

.dashboard-tag-sidebar__create-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.dashboard-tag-sidebar__scroll {
  min-width: 0;
  max-width: 100%;
  min-height: 0;
  max-height: inherit;
  flex: 1;
  padding: 8px;
}

.dashboard-tag-sidebar__list {
  display: flex;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.dashboard-tag-sidebar__list .sortable-list,
.dashboard-tag-sidebar__list .sortable-list__items,
.dashboard-tag-sidebar__list .sortable-list__item {
  min-width: 0;
  max-width: 100%;
}

.dashboard-tag-sidebar__list .sortable-list__items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

@media (width <= 768px) {
  .dashboard-tag-sidebar {
    position: static;
    overflow: hidden;
    max-height: none;
  }

  .dashboard-tag-sidebar__scroll {
    max-height: none;
  }

  .dashboard-tag-sidebar__list {
    overflow: auto hidden;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    flex-flow: row nowrap;
    justify-content: flex-start;
    scrollbar-color: hsl(var(--border)) transparent;
    scrollbar-width: thin;
  }

  .dashboard-tag-sidebar__list::-webkit-scrollbar {
    height: 6px;
  }

  .dashboard-tag-sidebar__list::-webkit-scrollbar-track {
    background: transparent;
  }

  .dashboard-tag-sidebar__list::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background-color: hsl(var(--border));
  }

  .dashboard-tag-sidebar__list::-webkit-scrollbar-thumb:hover {
    background-color: hsl(var(--border) / 80%);
  }

  .dashboard-tag-sidebar__list .sortable-list.sortable-list,
  .dashboard-tag-sidebar__list .sortable-list__items,
  .dashboard-tag-sidebar__list .sortable-list__item {
    width: auto;
    min-width: min-content;
    max-width: none;
    flex: 0 0 auto;
  }

  .dashboard-tag-sidebar__list .sortable-list__items {
    flex-flow: row nowrap;
  }

  .dashboard-tag-sidebar__list .sortable-list .sortable-list__item {
    touch-action: pan-x;
  }

  .dashboard-tag-sidebar__list .dashboard-tag-list-item {
    width: auto;
    min-width: min-content;
    flex: 0 0 auto;
  }

  .dashboard-tag-sidebar__list .dashboard-tag-list-item__drag-handle {
    display: none;
  }
}
</style>
