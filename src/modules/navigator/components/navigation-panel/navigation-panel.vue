<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { BookmarkIcon, FolderTreeIcon } from '@lucide/vue';
import { TreeView } from './tree-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRestoredChoice } from '@/composables/use-restored-active-tab';
import QuickAccessList from '@/modules/nav-sidebar/components/quick-access-list.vue';

const NAVIGATION_PANEL_VIEWS = ['tree', 'quick-access'] as const;

defineProps<{
  activePath: string;
  updatesPaused: boolean;
}>();

const emit = defineEmits<{
  navigate: [path: string];
}>();

const { t } = useI18n();
const activeView = useRestoredChoice('navigator-navigation-panel', NAVIGATION_PANEL_VIEWS, 'tree');
const isTreeViewActive = computed(() => activeView.value === 'tree');

function handleNavigate(path: string) {
  emit('navigate', path);
}
</script>

<template>
  <section class="navigation-panel">
    <Tabs
      v-model="activeView"
      class="navigation-panel__tabs"
      :unmount-on-hide="false"
    >
      <TabsList class="navigation-panel__tabs-list">
        <TabsTrigger
          value="tree"
          :title="t('navigator.navigationPanelTree')"
        >
          <FolderTreeIcon
            :size="16"
            aria-hidden="true"
            class="navigation-panel__tab-icon"
          />
          <span class="navigation-panel__tab-label">
            {{ t('navigator.navigationPanelTree') }}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="quick-access"
          :title="t('quickAccess.title')"
        >
          <BookmarkIcon
            :size="16"
            aria-hidden="true"
            class="navigation-panel__tab-icon"
          />
          <span class="navigation-panel__tab-label">
            {{ t('quickAccess.title') }}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="tree"
        class="navigation-panel__tab-content animate-fade-in"
      >
        <TreeView
          class="navigation-panel__view"
          :active-path="activePath"
          :updates-paused="updatesPaused"
          :is-view-active="isTreeViewActive"
          @navigate="handleNavigate"
        />
      </TabsContent>

      <TabsContent
        value="quick-access"
        class="navigation-panel__tab-content animate-fade-in"
      >
        <QuickAccessList class="navigation-panel__view" />
      </TabsContent>
    </Tabs>
  </section>
</template>

<style scoped>
.navigation-panel {
  display: flex;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  border-radius: var(--radius-sm);
}

.navigation-panel__tabs {
  display: flex;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 6px 6px 0;
  gap: 6px;
}

.navigation-panel__tabs-list {
  display: flex;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  height: 2.125rem;
  flex-shrink: 0;
  border-radius: var(--radius);
  background-color: hsl(var(--muted) / 50%);
  gap: 4px;
}

.navigation-panel__tabs-list :deep(.sigma-ui-tabs-trigger) {
  position: relative;
  overflow: hidden;
  min-width: 0;
  flex: 0 0 auto;
  padding-inline: 0.5rem;
}

.navigation-panel__tabs-list :deep(.sigma-ui-tabs-trigger[data-state="active"]) {
  flex: 1 1 auto;
}

.navigation-panel__tabs-list :deep(.sigma-ui-tabs-trigger:not([data-state="active"]) .navigation-panel__tab-label) {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  padding: 0;
  border-width: 0;
  margin: -1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

.navigation-panel__tab-icon {
  flex-shrink: 0;
}

.navigation-panel__tab-label {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
}

.navigation-panel__tab-content {
  display: flex;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin-top: 0;
  margin-inline: -6px;
}

.navigation-panel__tab-content[data-state="inactive"] {
  display: none;
}

.navigation-panel__view {
  overflow: hidden;
  min-height: 0;
  flex: 1;
}
</style>
