<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { InfoIcon, XIcon } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import InfoPanelHeader from './info-panel-header.vue';
import InfoPanelPreview from './info-panel-preview.vue';
import InfoPanelProperties from './info-panel-properties.vue';
import type { DirEntry } from '@/types/dir-entry';

defineProps<{
  selectedEntry: DirEntry | null;
  isCurrentDir?: boolean;
}>();

const isCompact = ref(false);
const isDrawerOpen = ref(false);
const mediaQuery = window.matchMedia('(max-width: 800px)');

function handleMediaChange(event: MediaQueryListEvent | MediaQueryList) {
  isCompact.value = event.matches;
}

onMounted(() => {
  handleMediaChange(mediaQuery);
  mediaQuery.addEventListener('change', handleMediaChange);
});

onUnmounted(() => {
  mediaQuery.removeEventListener('change', handleMediaChange);
});
</script>

<template>
  <div class="info-panel">
    <InfoPanelPreview
      :selected-entry="selectedEntry"
      :is-current-dir="isCurrentDir"
    />
    <InfoPanelHeader :selected-entry="selectedEntry" />
    <InfoPanelProperties
      :selected-entry="selectedEntry"
      :orientation="isCompact ? 'compact' : 'vertical'"
    />
    <Button
      v-if="isCompact"
      size="xs"
      variant="ghost"
      class="info-panel__expand-btn"
      @click="isDrawerOpen = true"
    >
      <InfoIcon :size="16" />
    </Button>

    <Teleport to="body">
      <Transition name="info-panel-drawer">
        <div
          v-if="isDrawerOpen"
          class="info-panel-drawer__backdrop"
          @click="isDrawerOpen = false"
        >
          <div
            class="info-panel-drawer"
            @click.stop
          >
            <div class="info-panel-drawer__close">
              <Button
                size="xs"
                variant="ghost"
                @click="isDrawerOpen = false"
              >
                <XIcon :size="16" />
              </Button>
            </div>
            <InfoPanelPreview
              :selected-entry="selectedEntry"
              :is-current-dir="isCurrentDir"
            />
            <InfoPanelHeader :selected-entry="selectedEntry" />
            <InfoPanelProperties
              :selected-entry="selectedEntry"
              orientation="vertical"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.info-panel {
  display: flex;
  overflow: hidden;
  width: 280px;
  min-width: 280px;
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
.info-panel-drawer__backdrop {
  position: fixed;
  z-index: 50;
  background-color: rgb(0 0 0 / 50%);
  inset: 0;
}

.info-panel-drawer {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  overflow: hidden;
  width: 280px;
  height: 100%;
  flex-direction: column;
  padding: 6px;
  background-color: hsl(var(--background-2));
  box-shadow: -4px 0 16px rgb(0 0 0 / 20%);
}

.info-panel-drawer__close {
  display: flex;
  justify-content: flex-end;
  padding: 4px;
}

.info-panel-drawer-enter-active .info-panel-drawer__backdrop,
.info-panel-drawer-leave-active .info-panel-drawer__backdrop {
  transition: opacity 0.25s ease;
}

.info-panel-drawer-enter-active .info-panel-drawer,
.info-panel-drawer-leave-active .info-panel-drawer {
  transition: transform 0.25s ease;
}

.info-panel-drawer-enter-from {
  opacity: 0;
}

.info-panel-drawer-enter-from .info-panel-drawer {
  transform: translateX(100%);
}

.info-panel-drawer-leave-to {
  opacity: 0;
}

.info-panel-drawer-leave-to .info-panel-drawer {
  transform: translateX(100%);
}
</style>
