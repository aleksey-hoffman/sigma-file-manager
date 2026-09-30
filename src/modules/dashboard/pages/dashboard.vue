<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import {
  ChevronRightIcon,
  StarIcon,
  TagIcon,
  TrendingUpIcon,
  ClockIcon,
  XIcon,
} from '@lucide/vue';
import { PageDefaultLayout } from '@/layouts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DirEntryInteractive } from '@/components/dir-entry-interactive';
import {
  FREQUENT_ITEMS_MAX,
  HISTORY_MAX_ITEMS,
  useUserStatsStore,
} from '@/stores/storage/user-stats';
import { usePageDropZone } from '@/composables/use-page-drop-zone';
import { useRestoredChoice } from '@/composables/use-restored-active-tab';
import { useFileDropOperation } from '@/composables/use-file-drop-operation';
import { formatDashboardRelativeTime } from '@/utils/dashboard-relative-time';
import { guessPathIsFile } from '@/utils/dashboard-item-is-file';
import { isVirtualLocationPath } from '@/utils/virtual-locations';
import DashboardActionBar from '@/modules/dashboard/components/dashboard-action-bar.vue';
import DashboardEmptyState from '@/modules/dashboard/components/dashboard-empty-state.vue';
import DashboardHero from '@/modules/dashboard/components/dashboard-hero.vue';
import DashboardOpenFolderButton from '@/modules/dashboard/components/dashboard-open-folder-button.vue';
import DashboardTaggedView from '@/modules/dashboard/components/dashboard-tagged-view.vue';
import EntryCard from '@/modules/dashboard/components/entry-card.vue';
import { provideDashboardEntryPreviews } from '@/modules/dashboard/composables/use-dashboard-entry-previews';
import { useDashboardItemOpener } from '@/modules/dashboard/composables/use-dashboard-item-opener';
import FileBrowserConflictDialog from '@/modules/navigator/components/file-browser/file-browser-conflict-dialog.vue';
import FileBrowserTopLevelConflictDialog from '@/modules/navigator/components/file-browser/file-browser-top-level-conflict-dialog.vue';
import type { FavoriteItem } from '@/types/user-stats';
import {
  DASHBOARD_CARD_ENTRANCE,
  getDashboardContentEntranceBinding,
  getStaggerSlideUpBinding,
} from '@/utils/stagger-animation';

const { t } = useI18n();
const route = useRoute();
const userStatsStore = useUserStatsStore();
provideDashboardEntryPreviews();
const { openItem } = useDashboardItemOpener();

const DASHBOARD_TABS = ['favorites', 'tagged', 'frequent', 'history'] as const;

type DashboardTab = typeof DASHBOARD_TABS[number];

const activeTab = useRestoredChoice('dashboard', DASHBOARD_TABS, 'favorites');
const dashboardContentEntrance = getDashboardContentEntranceBinding();
const dropContainerRef = ref<HTMLElement | null>(null);

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

watch(() => route.query.tab, (tabQuery) => {
  activeTab.value = tabQuery;
}, { immediate: true });

const favoriteItems = computed(() => userStatsStore.favorites);
const taggedItems = computed(() => userStatsStore.taggedItems);
const historyItems = computed(() => userStatsStore.sortedHistory);
const frequentItems = computed(() => userStatsStore.sortedFrequentItems);
const dashboardTabs = computed(() => [
  createDashboardTab('favorites', StarIcon, 'amber', favoriteItems.value.length),
  createDashboardTab('tagged', TagIcon, 'purple', taggedItems.value.length),
  createDashboardTab('frequent', TrendingUpIcon, 'blue', frequentItems.value.length, FREQUENT_ITEMS_MAX),
  createDashboardTab('history', ClockIcon, 'green', historyItems.value.length, HISTORY_MAX_ITEMS),
]);

function createDashboardTab(
  value: DashboardTab,
  icon: Component,
  tone: string,
  count: number,
  limit?: number,
) {
  const isCapped = limit !== undefined && count >= limit;

  return {
    value,
    icon,
    tone,
    count,
    label: t(`dashboard.tabs.${value}`),
    countScope: {
      short: t(isCapped ? 'dashboard.countScope.last' : 'dashboard.countScope.total'),
      long: t(isCapped ? 'dashboard.countScope.lastItems' : 'dashboard.countScope.totalItems'),
    },
  };
}

function isFavoriteFile(item: FavoriteItem): boolean {
  if (isVirtualLocationPath(item.path)) {
    return false;
  }

  return guessPathIsFile(item.path);
}

function formatRelativeTime(timestamp: number): string {
  return formatDashboardRelativeTime(timestamp, (key, count) => {
    return count === undefined ? t(key) : t(key, count);
  });
}

</script>

<template>
  <PageDefaultLayout class="dashboard-page">
    <div ref="dropContainerRef">
      <Tabs
        v-model="activeTab"
        class="dashboard-page__tabs"
      >
        <DashboardHero
          :title="t('pages.dashboard')"
          :subtitle="t('dashboard.subtitle')"
        >
          <TabsList class="dashboard-page__tabs-list">
            <TabsTrigger
              v-for="tab in dashboardTabs"
              :key="tab.value"
              :value="tab.value"
              class="dashboard-page__tab-card"
              :class="`dashboard-page__tab-card--${tab.tone}`"
            >
              <span class="dashboard-page__tab-card-icon">
                <component
                  :is="tab.icon"
                  :size="20"
                />
              </span>
              <span class="dashboard-page__tab-card-text">
                <span class="dashboard-page__tab-card-label">{{ tab.label }}</span>
                <span class="dashboard-page__tab-card-count">
                  {{ tab.count }}
                  <span class="dashboard-page__tab-card-count-scope">
                    <span class="dashboard-page__tab-card-count-scope-short">{{ tab.countScope.short }}</span>
                    <span class="dashboard-page__tab-card-count-scope-long">{{ tab.countScope.long }}</span>
                  </span>
                </span>
              </span>
              <ChevronRightIcon
                :size="16"
                class="dashboard-page__tab-card-chevron"
              />
            </TabsTrigger>
          </TabsList>
        </DashboardHero>

        <TabsContent
          value="favorites"
          class="dashboard-page__tab-content"
        >
          <DashboardActionBar
            :title="t('dashboard.tabs.favorites')"
            :is-empty="favoriteItems.length === 0"
            @clear-all="userStatsStore.clearAllFavorites()"
          />
          <DashboardEmptyState
            v-if="favoriteItems.length === 0"
            v-bind="dashboardContentEntrance"
            type="favorites"
            :title="t('dashboard.emptyFavorites')"
            :description="t('dashboard.emptyFavoritesDescription')"
          />
          <div
            v-else
            v-bind="dashboardContentEntrance"
            class="dashboard-page__items-grid"
          >
            <DirEntryInteractive
              v-for="(item, itemIndex) in favoriteItems"
              :key="item.path"
              :path="item.path"
              :is-file="isFavoriteFile(item)"
            >
              <EntryCard
                v-bind="getStaggerSlideUpBinding(itemIndex, DASHBOARD_CARD_ENTRANCE)"
                :path="item.path"
                :is-file="isFavoriteFile(item)"
                @click="openItem(item.path, isFavoriteFile(item))"
              >
                <template #actions>
                  <DashboardOpenFolderButton :path="item.path" />
                </template>
              </EntryCard>
            </DirEntryInteractive>
          </div>
        </TabsContent>

        <TabsContent
          value="tagged"
          class="dashboard-page__tab-content"
        >
          <DashboardTaggedView />
        </TabsContent>

        <TabsContent
          value="frequent"
          class="dashboard-page__tab-content"
        >
          <DashboardActionBar
            :title="t('dashboard.tabs.frequent')"
            :is-empty="frequentItems.length === 0"
            @clear-all="userStatsStore.clearAllFrequent()"
          />
          <DashboardEmptyState
            v-if="frequentItems.length === 0"
            v-bind="dashboardContentEntrance"
            type="frequent"
            :title="t('dashboard.emptyFrequent')"
            :description="t('dashboard.emptyFrequentDescription')"
          />
          <div
            v-else
            v-bind="dashboardContentEntrance"
            class="dashboard-page__items-grid"
          >
            <DirEntryInteractive
              v-for="(item, itemIndex) in frequentItems"
              :key="item.path"
              :path="item.path"
              :is-file="item.isFile"
            >
              <EntryCard
                v-bind="getStaggerSlideUpBinding(itemIndex, DASHBOARD_CARD_ENTRANCE)"
                :path="item.path"
                :is-file="item.isFile"
                @click="openItem(item.path, item.isFile)"
              >
                <div class="entry-card__stats">
                  <span class="entry-card__badge">{{ t('dashboard.openedCount', item.openCount) }}</span>
                </div>
                <template #actions>
                  <DashboardOpenFolderButton :path="item.path" />
                </template>
              </EntryCard>
            </DirEntryInteractive>
          </div>
        </TabsContent>

        <TabsContent
          value="history"
          class="dashboard-page__tab-content"
        >
          <DashboardActionBar
            :title="t('dashboard.tabs.history')"
            :is-empty="historyItems.length === 0"
            @clear-all="userStatsStore.clearHistory()"
          />
          <DashboardEmptyState
            v-if="historyItems.length === 0"
            v-bind="dashboardContentEntrance"
            type="history"
            :title="t('dashboard.emptyHistory')"
            :description="t('dashboard.emptyHistoryDescription')"
          />
          <div
            v-else
            v-bind="dashboardContentEntrance"
            class="dashboard-page__items-grid"
          >
            <DirEntryInteractive
              v-for="(item, itemIndex) in historyItems"
              :key="`${item.path}-${item.openedAt}`"
              :path="item.path"
              :is-file="item.isFile"
            >
              <EntryCard
                v-bind="getStaggerSlideUpBinding(itemIndex, DASHBOARD_CARD_ENTRANCE)"
                :path="item.path"
                :is-file="item.isFile"
                @click="openItem(item.path, item.isFile)"
              >
                <span class="entry-card__time">{{ formatRelativeTime(item.openedAt) }}</span>
                <template #actions>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="entry-card__action dashboard-page__remove-action"
                        :aria-label="t('dashboard.actions.confirmRemove')"
                        @click="userStatsStore.removeFromHistory(item.path, item.openedAt)"
                      >
                        <XIcon :size="14" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ t('dashboard.actions.confirmRemove') }}
                    </TooltipContent>
                  </Tooltip>
                  <DashboardOpenFolderButton :path="item.path" />
                </template>
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
  </PageDefaultLayout>
</template>

<style>
.dashboard-page__tabs {
  display: flex;
  flex-direction: column;
}

.dashboard-page__tabs-list.sigma-ui-tabs-list {
  display: grid;
  overflow: visible;
  width: 100%;
  height: auto;
  padding: 0;
  border-radius: 0;
  background-color: transparent;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.dashboard-page__tab-card--amber {
  --dashboard-tab-tone: 42 90% 55%;
}

.dashboard-page__tab-card--purple {
  --dashboard-tab-tone: 262 83% 66%;
}

.dashboard-page__tab-card--blue {
  --dashboard-tab-tone: 217 91% 60%;
}

.dashboard-page__tab-card--green {
  --dashboard-tab-tone: 152 60% 48%;
}

.dashboard-page__tab-card.sigma-ui-tabs-trigger {
  --dashboard-tab-glow-origin-x: 36px;
  --dashboard-tab-glow-strength: 8%;

  min-width: 0;
  justify-content: flex-start;
  padding: 12px 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  background-image: radial-gradient(
    circle at var(--dashboard-tab-glow-origin-x) 50%,
    hsl(var(--dashboard-tab-tone) / var(--dashboard-tab-glow-strength)),
    transparent 180px
  );
  color: hsl(var(--foreground));
  container: dashboard-tab-card / inline-size;
  gap: 12px;
  text-align: start;
  transition:
    background-color var(--hover-transition-duration-out) var(--hover-transition-easing-out),
    border-color var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.dashboard-page__tab-card.sigma-ui-tabs-trigger:hover {
  background-color: hsl(var(--muted));
  transition:
    background-color var(--hover-transition-duration-in),
    border-color var(--hover-transition-duration-in);
}

.dashboard-page__tab-card.sigma-ui-tabs-trigger[data-state="active"] {
  --dashboard-tab-glow-strength: 16%;

  border-color: hsl(var(--dashboard-tab-tone) / 35%);
  box-shadow: none;
}

.dashboard-page__tab-card-icon {
  display: flex;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--dashboard-tab-tone) / 20%);
  border-radius: var(--radius-sm);
  background-color: hsl(var(--dashboard-tab-tone) / 12%);
  color: hsl(var(--dashboard-tab-tone));
}

.dashboard-page__tab-card-text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.dashboard-page__tab-card-label {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  font-weight: 500;
  text-overflow: ellipsis;
}

.dashboard-page__tab-card-count {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 1.125rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
}

.dashboard-page__tab-card-count-scope {
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  font-weight: 400;
  margin-inline-start: 2px;
}

.dashboard-page__tab-card-count-scope-long {
  display: none;
}

@container dashboard-tab-card (width >= 16rem) {
  .dashboard-page__tab-card-count-scope-short {
    display: none;
  }

  .dashboard-page__tab-card-count-scope-long {
    display: inline;
  }
}

.dashboard-page__tab-card-chevron {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
  opacity: 0.6;
}

.dashboard-page__tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dashboard-page__items-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.dashboard-page__remove-action.sigma-ui-button {
  width: 28px;
  height: 28px;
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
    gap: 8px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-page__tab-card.sigma-ui-tabs-trigger {
    --dashboard-tab-glow-origin-x: 28px;

    padding: 10px 12px;
    gap: 10px;
  }

  .dashboard-page__tab-card-icon {
    width: 32px;
    height: 32px;
  }

  .dashboard-page__tab-card-chevron {
    display: none;
  }
}
</style>
