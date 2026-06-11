<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref } from 'vue';
import { InfoIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import InfoPanelHeader from './info-panel-header.vue';
import InfoPanelPreview from './info-panel-preview.vue';
import InfoPanelProperties from './info-panel-properties.vue';
import InfoPanelResizableLayout from './info-panel-resizable-layout.vue';
import InfoPanelDrawerLayout from './info-panel-drawer-layout.vue';
import type { DirEntry } from '@/types/dir-entry';
import { useIsSmallScreen } from '@/composables/use-responsive-query';

const props = defineProps<{
  selectedEntry: DirEntry | null;
  isCurrentDir?: boolean;
}>();

const isCompact = useIsSmallScreen();
const isDrawerOpen = ref(false);
</script>

<template>
  <div class="info-panel info-panel-hover-reveal">
    <InfoPanelResizableLayout
      v-if="!isCompact"
      :selected-entry="props.selectedEntry"
      :is-current-dir="props.isCurrentDir"
    />
    <template v-else>
      <InfoPanelPreview
        :selected-entry="props.selectedEntry"
        :is-current-dir="props.isCurrentDir"
      />
      <InfoPanelHeader
        :selected-entry="props.selectedEntry"
        :show-reset-button="false"
      />
      <InfoPanelProperties
        :selected-entry="props.selectedEntry"
        orientation="compact"
      />
      <Button
        size="xs"
        variant="ghost"
        class="info-panel__expand-btn"
        @click="isDrawerOpen = true"
      >
        <InfoIcon :size="16" />
      </Button>
    </template>
  </div>

  <Drawer
    v-if="isCompact"
    :open="isDrawerOpen"
    direction="bottom"
    :should-scale-background="false"
    @update:open="isDrawerOpen = $event"
  >
    <DrawerContent class="info-panel-compact-drawer">
      <div class="info-panel-compact-drawer__body">
        <InfoPanelDrawerLayout
          :selected-entry="props.selectedEntry"
          :is-current-dir="props.isCurrentDir"
        />
      </div>
    </DrawerContent>
  </Drawer>
</template>

<style scoped>
.info-panel {
  display: flex;
  overflow: hidden;
  width: max(100%, var(--info-panel-content-min-width, 0px));
  min-width: var(--info-panel-content-min-width, 0);
  height: 100%;
  flex-direction: column;
  flex-shrink: 0;
  padding: 6px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background-2));
}

@media (width <= 800px) {
  .info-panel {
    display: grid;
    overflow: hidden;
    width: 100%;
    min-width: unset;
    height: auto;
    gap: 2px 10px;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
  }

  .info-panel :deep(.info-panel-preview) {
    overflow: hidden;
    width: 48px;
    height: 48px;
    align-self: center;
    border-radius: var(--radius-xs);
    grid-column: 1;
    grid-row: 1 / 3;
  }

  .info-panel :deep(.info-panel-preview) svg {
    width: 28px;
    height: 28px;
  }

  .info-panel :deep(.info-panel-header) {
    overflow: hidden;
    height: auto;
    min-height: unset;
    align-self: end;
    padding: 0;
    border-bottom: none;
    gap: 6px;
    grid-column: 2;
    grid-row: 1;
  }

  .info-panel :deep(.info-panel-header__icon) {
    display: none;
  }

  .info-panel :deep(.info-panel-header__name) {
    font-size: 13px;
    line-height: 1.3;
  }

  .info-panel :deep(.info-panel-properties) {
    overflow: hidden;
    min-width: 0;
    height: auto;
    align-self: start;
    grid-column: 2;
    grid-row: 2;
  }

  .info-panel__expand-btn {
    align-self: center;
    color: hsl(var(--muted-foreground));
    grid-column: 3;
    grid-row: 1 / 3;
  }
}
</style>

<style>
.info-panel-compact-drawer.sigma-ui-drawer-content {
  display: flex;
  overflow: hidden;
  width: 100%;
  height: min(65vh, calc(100vh - var(--window-toolbar-height) - 8px));
  min-height: 240px;
  max-height: calc(100vh - var(--window-toolbar-height) - 8px);
  flex-direction: column;
  padding: 6px;
  padding-top: 0;
  border-color: hsl(var(--border));
  margin-top: 0;
  background-color: hsl(var(--background-2));
}

.info-panel-compact-drawer__body {
  display: flex;
  overflow: hidden;
  width: 100%;
  min-height: 0;
  flex: 1;
  padding-top: 8px;
}

.info-panel-compact-drawer__body > .info-panel-drawer-layout {
  min-height: 0;
  flex: 1;
}

.info-panel-compact-drawer__body > .info-panel-drawer-layout.sigma-ui-scroll-area {
  height: 100%;
}

.info-panel-compact-drawer__body .sigma-ui-scroll-area__viewport {
  max-height: 100%;
}
</style>
