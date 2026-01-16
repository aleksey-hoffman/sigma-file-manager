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
  FolderIcon,
  FileIcon,
  XIcon,
} from 'lucide-vue-next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TagSelector } from '@/components/ui/tag-selector';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import DashboardActionBar from '@/modules/dashboard/components/dashboard-action-bar.vue';
import DashboardEmptyState from '@/modules/dashboard/components/dashboard-empty-state.vue';
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

function getItemName(path: string | null | undefined): string {
  if (!path) return '';
  const segments = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return segments[segments.length - 1] || path;
}

function getItemDirectory(path: string | null | undefined): string {
  if (!path) return '';
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

function isDirectory(path: string): boolean {
  return path.endsWith('/') || !path.includes('.');
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
  <ScrollArea class="dashboard-page">
    <div class="dashboard-page__container">
      <header class="dashboard-page__header">
        <h1 class="dashboard-page__title">
          {{ t('pages.dashboard') }}
        </h1>
        <p class="dashboard-page__subtitle">
          {{ t('dashboard.subtitle') }}
        </p>
      </header>

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
            <button
              v-for="item in favoriteItems"
              :key="item.path"
              type="button"
              class="dashboard-item"
              @click="openFavoriteItem(item)"
            >
              <div class="dashboard-item__icon">
                <FolderIcon
                  v-if="isDirectory(item.path)"
                  :size="20"
                />
                <FileIcon
                  v-else
                  :size="20"
                />
              </div>
              <div class="dashboard-item__content">
                <span class="dashboard-item__name">{{ getItemName(item.path) }}</span>
                <span class="dashboard-item__path">{{ getItemDirectory(item.path) }}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="dashboard-item__action"
                @click="removeFavorite(item.path, $event)"
              >
                <XIcon :size="14" />
              </Button>
            </button>
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
            <div
              v-for="item in taggedItems"
              :key="item.path"
              class="dashboard-item dashboard-item--tagged"
            >
              <button
                type="button"
                class="dashboard-item__main"
                @click="openItem(item.path, item.isFile)"
              >
                <div class="dashboard-item__icon">
                  <FolderIcon
                    v-if="!item.isFile"
                    :size="20"
                  />
                  <FileIcon
                    v-else
                    :size="20"
                  />
                </div>
                <div class="dashboard-item__content">
                  <span class="dashboard-item__name">{{ getItemName(item.path) }}</span>
                  <span class="dashboard-item__path">{{ getItemDirectory(item.path) }}</span>
                </div>
              </button>
              <div class="dashboard-item__tag-actions">
                <div class="dashboard-item__tags">
                  <span
                    v-for="tagId in item.tagIds"
                    :key="tagId"
                    class="dashboard-item__tag"
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
              </div>
            </div>
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
            class="dashboard-page__items-list"
          >
            <button
              v-for="item in frequentItems"
              :key="item.path"
              type="button"
              class="dashboard-item dashboard-item--list"
              @click="openFrequentItem(item)"
            >
              <div class="dashboard-item__icon">
                <FolderIcon
                  v-if="!item.isFile"
                  :size="20"
                />
                <FileIcon
                  v-else
                  :size="20"
                />
              </div>
              <div class="dashboard-item__content">
                <span class="dashboard-item__name">{{ getItemName(item.path) }}</span>
                <span class="dashboard-item__path">{{ getItemDirectory(item.path) }}</span>
              </div>
              <div class="dashboard-item__stats">
                <span class="dashboard-item__count">{{ t('dashboard.openedCount', item.openCount) }}</span>
              </div>
            </button>
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
            class="dashboard-page__items-list"
          >
            <button
              v-for="item in historyItems"
              :key="`${item.path}-${item.openedAt}`"
              type="button"
              class="dashboard-item dashboard-item--list"
              @click="openHistoryItem(item)"
            >
              <div class="dashboard-item__icon">
                <FolderIcon
                  v-if="!item.isFile"
                  :size="20"
                />
                <FileIcon
                  v-else
                  :size="20"
                />
              </div>
              <div class="dashboard-item__content">
                <span class="dashboard-item__name">{{ getItemName(item.path) }}</span>
                <span class="dashboard-item__path">{{ getItemDirectory(item.path) }}</span>
              </div>
              <div class="dashboard-item__time">
                <span>{{ formatRelativeTime(item.openedAt) }}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="dashboard-item__action"
                @click="removeHistoryItem(item.path, item.openedAt, $event)"
              >
                <XIcon :size="14" />
              </Button>
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </ScrollArea>
</template>

<style>
.dashboard-page {
  height: calc(100vh - var(--window-toolbar-height));
  user-select: none;
}

.dashboard-page__container {
  display: flex;
  max-width: 1200px;
  flex-direction: column;
  padding: 32px 48px;
  margin: 0 auto;
  gap: 32px;
}

.dashboard-page__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dashboard-page__title {
  color: hsl(var(--foreground));
  font-family: "Space Grotesk", Inter, system-ui, sans-serif;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.025em;
}

.dashboard-page__subtitle {
  color: hsl(var(--muted-foreground));
  font-size: 0.95rem;
}

.dashboard-page__tabs {
  display: flex;
  flex-direction: column;
  gap: 24px;
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
  animation: fade-in 0.2s ease-out;
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

.dashboard-page__items-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dashboard-item {
  position: relative;
  display: flex;
  overflow: hidden;
  align-items: center;
  padding: 12px 16px;
  border: none;
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  cursor: pointer;
  gap: 12px;
  text-align: left;
  transition: all 0.15s ease;
}

.dashboard-item:hover {
  background-color: hsl(var(--muted));
}

.dashboard-item:hover .dashboard-item__action {
  opacity: 1;
}

.dashboard-item--list {
  border-radius: var(--radius-sm);
  background-color: transparent;
}

.dashboard-item--list:hover {
  background-color: hsl(var(--muted) / 50%);
}

.dashboard-item__icon {
  display: flex;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--primary));
}

.dashboard-item--list .dashboard-item__icon {
  width: 32px;
  height: 32px;
}

.dashboard-item__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.dashboard-item__name {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 0.9rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-item__path {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.dashboard-item__tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.dashboard-item__stats {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.dashboard-item__count {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  font-weight: 500;
}

.dashboard-item__time {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
}

.dashboard-item__action {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.dashboard-item__action:hover {
  color: hsl(var(--destructive));
}

.dashboard-item--tagged {
  display: flex;
  flex-direction: column;
  padding: 0;
  gap: 0;
}

.dashboard-item__main {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 12px 16px;
  border: none;
  background: none;
  cursor: pointer;
  gap: 12px;
  text-align: left;
}

.dashboard-item__tag-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 12px;
  gap: 8px;
}

@media (width <= 768px) {
  .dashboard-page__container {
    padding: 24px 16px;
  }

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

  .dashboard-page__items-grid {
    grid-template-columns: 1fr;
  }
}
</style>
