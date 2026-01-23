<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  StarIcon,
  TagIcon,
  TrendingUpIcon,
  ClockIcon,
  XIcon,
} from 'lucide-vue-next';
import { DefaultLayout } from '@/layouts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TagSelector } from '@/components/ui/tag-selector';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import DashboardActionBar from '@/modules/dashboard/components/dashboard-action-bar.vue';
import DashboardEmptyState from '@/modules/dashboard/components/dashboard-empty-state.vue';
import EntryCard from '@/modules/dashboard/components/entry-card.vue';
import type {
  FavoriteItem,
  HistoryItem,
  FrequentItem,
  ItemTag,
  TaggedItem,
} from '@/types/user-stats';

const { t } = useI18n();
const router = useRouter();
const userStatsStore = useUserStatsStore();
const workspacesStore = useWorkspacesStore();

const activeTab = ref('favorites');

const favoriteItems = computed(() => userStatsStore.favorites);
const taggedItems = computed(() => userStatsStore.taggedItems);
const historyItems = computed(() => userStatsStore.sortedHistory);
const frequentItems = computed(() => userStatsStore.sortedFrequentItems);
const tags = computed(() => userStatsStore.tags);

function getTagById(tagId: string): ItemTag | undefined {
  return tags.value.find(tag => tag.id === tagId);
}

function getItemDirectory(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/');
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  return lastSlashIndex > 0 ? normalizedPath.substring(0, lastSlashIndex) : normalizedPath;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return t('dashboard.justNow');
  if (diffMinutes < 60) return t('dashboard.minutesAgo', diffMinutes);
  if (diffHours < 24) return t('dashboard.hoursAgo', diffHours);
  return t('dashboard.daysAgo', diffDays);
}

async function openItem(path: string, isFile: boolean) {
  try {
    if (isFile) {
      const directory = getItemDirectory(path);
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
  const isFile = !item.path.endsWith('/') && item.path.includes('.');
  await openItem(item.path, isFile);
}

async function openHistoryItem(item: HistoryItem) {
  await openItem(item.path, item.isFile);
}

async function openFrequentItem(item: FrequentItem) {
  await openItem(item.path, item.isFile);
}

async function removeFavorite(path: string, event: MouseEvent) {
  event.stopPropagation();
  await userStatsStore.removeFromFavorites(path);
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
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const newTag = await userStatsStore.createTag(name, randomColor);

  await userStatsStore.addTagToItem(item.path, newTag.id, item.isFile);
}

async function handleDeleteTag(tagId: string) {
  await userStatsStore.deleteTag(tagId);
}
</script>

<template>
  <DefaultLayout
    class="dashboard-page"
    :title="t('pages.dashboard')"
    :subtitle="t('dashboard.subtitle')"
  >
    <Tabs
      v-model="activeTab"
      default-value="favorites"
      class="dashboard-page__tabs"
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

      <TabsContent
        value="favorites"
        class="dashboard-page__tab-content"
      >
        <DashboardActionBar
          :is-empty="favoriteItems.length === 0"
          @clear-all="userStatsStore.clearAllFavorites()"
        />
        <DashboardEmptyState
          v-if="favoriteItems.length === 0"
          type="favorites"
          :title="t('dashboard.emptyFavorites')"
          :description="t('dashboard.emptyFavoritesDescription')"
        />
        <div
          v-else
          class="dashboard-page__items-grid"
        >
          <EntryCard
            v-for="item in favoriteItems"
            :key="item.path"
            :path="item.path"
            @click="openFavoriteItem(item)"
          >
            <Button
              variant="ghost"
              size="icon"
              class="entry-card__action"
              @click="removeFavorite(item.path, $event)"
            >
              <XIcon :size="14" />
            </Button>
          </EntryCard>
        </div>
      </TabsContent>

      <TabsContent
        value="tagged"
        class="dashboard-page__tab-content"
      >
        <DashboardActionBar
          :is-empty="taggedItems.length === 0"
          @clear-all="userStatsStore.clearAllTagged()"
        />
        <DashboardEmptyState
          v-if="taggedItems.length === 0"
          type="tagged"
          :title="t('dashboard.emptyTagged')"
          :description="t('dashboard.emptyTaggedDescription')"
        />
        <div
          v-else
          class="dashboard-page__items-grid"
        >
          <EntryCard
            v-for="item in taggedItems"
            :key="item.path"
            :path="item.path"
            :is-file="item.isFile"
            @click="openItem(item.path, item.isFile)"
          >
            <template #footer>
              <div class="entry-card__tags">
                <span
                  v-for="tagId in item.tagIds"
                  :key="tagId"
                  class="entry-card__tag"
                  :style="{ backgroundColor: getTagById(tagId)?.color + '25', color: getTagById(tagId)?.color }"
                >
                  {{ getTagById(tagId)?.name }}
                </span>
              </div>
              <TagSelector
                :tags="tags"
                :selected-tag-ids="item.tagIds"
                :allow-create="true"
                trigger-variant="compact"
                @toggle-tag="(tagId) => handleToggleTagOnItem(item, tagId)"
                @create-tag="(name) => handleCreateTagForItem(item, name)"
                @delete-tag="handleDeleteTag"
              />
            </template>
          </EntryCard>
        </div>
      </TabsContent>

      <TabsContent
        value="frequent"
        class="dashboard-page__tab-content"
      >
        <DashboardActionBar
          :is-empty="frequentItems.length === 0"
          @clear-all="userStatsStore.clearAllFrequent()"
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
          <EntryCard
            v-for="item in frequentItems"
            :key="item.path"
            :path="item.path"
            :is-file="item.isFile"
            @click="openFrequentItem(item)"
          >
            <div class="entry-card__stats">
              <span class="entry-card__badge">{{ t('dashboard.openedCount', item.openCount) }}</span>
            </div>
          </EntryCard>
        </div>
      </TabsContent>

      <TabsContent
        value="history"
        class="dashboard-page__tab-content"
      >
        <DashboardActionBar
          :is-empty="historyItems.length === 0"
          @clear-all="userStatsStore.clearHistory()"
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
          <EntryCard
            v-for="item in historyItems"
            :key="`${item.path}-${item.openedAt}`"
            :path="item.path"
            :is-file="item.isFile"
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
        </div>
      </TabsContent>
    </Tabs>
  </DefaultLayout>
</template>

<style>
.dashboard-page__tabs {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-page__tabs-list {
  display: flex;
  padding: 4px;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 50%);
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

.dashboard-page__items-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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
