<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { NavSidebar, WindowToolbar } from '@/modules/shell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { InfusionWrapper } from '@/components/ui/infusion';
import { PageIframeLayout } from '@/layouts';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useChangelog } from '@/modules/changelog/composables/use-changelog';
import { useEmbedPages } from '@/modules/extensions/composables/use-embed-pages';
import { extensionDialogState } from '@/modules/extensions/api/dialog-state';
import { getActiveModals } from '@/modules/extensions/api/modal-state';

const ChangelogDialog = defineAsyncComponent(() => import('@/modules/changelog/components/changelog-dialog.vue'));
const ExtensionDialog = defineAsyncComponent(() => import('@/modules/extensions/components/extension-dialog.vue'));
const ExtensionEmbed = defineAsyncComponent(() => import('@/modules/extensions/components/extension-embed.vue'));
const CommandPalette = defineAsyncComponent(() => import('@/modules/extensions/components/command-palette.vue'));
const ExtensionModalsContainer = defineAsyncComponent(() => import('@/modules/extensions/components/extension-modals-container.vue'));

const userSettingsStore = useUserSettingsStore();
const { isOpen: isChangelogOpen } = useChangelog();
const { activeEmbedPageId, visitedEmbedPages } = useEmbedPages();
const activeModals = getActiveModals();
const hasStandaloneModals = computed(() => activeModals.value.some(modal => !modal.renderedInPalette));
</script>

<template>
  <div
    class="app-layout"
    :style="{ '--font': userSettingsStore.defaultFontFamily }"
  >
    <InfusionWrapper />
    <Toaster />
    <ChangelogDialog v-if="isChangelogOpen" />
    <ExtensionDialog v-if="extensionDialogState.isOpen" />
    <CommandPalette />
    <ExtensionModalsContainer v-if="hasStandaloneModals" />
    <TooltipProvider :delay-duration="userSettingsStore.userSettings.tooltipDelayMs">
      <NavSidebar />
      <div class="app-layout__main">
        <WindowToolbar />
        <div class="app-layout__content">
          <PageIframeLayout
            v-for="embedPage in visitedEmbedPages"
            :key="embedPage.pageId"
            :class="[
              'app-layout__extension-embed-page',
              { 'app-layout__extension-embed-page--hidden': activeEmbedPageId !== embedPage.pageId },
            ]"
          >
            <ExtensionEmbed
              class="app-layout__extension-embed"
              :extension-id="embedPage.extensionId"
              :embed-script-path="embedPage.url"
              :icon-path="embedPage.iconPath"
              :is-active="activeEmbedPageId === embedPage.pageId"
            />
          </PageIframeLayout>
          <RouterView v-slot="{ Component }">
            <div
              data-vaul-drawer-wrapper
              class="app-layout__router-view-wrapper"
            >
              <KeepAlive :include="['ExtensionPage']">
                <component
                  :is="Component"
                  :key="$route.name === 'extension-page' ? $route.params.fullPageId : $route.fullPath"
                />
              </KeepAlive>
            </div>
          </RouterView>
        </div>
      </div>
    </TooltipProvider>
  </div>
</template>

<style>
.app-layout {
  --default-font-family: var(--font, system-ui);

  display: flex;
  width: 100%;
  height: 100%;
  font-family: var(--default-font-family);
}

.app-layout__main {
  position: relative;
  display: flex;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  background-color: hsl(var(--background-3));
}

.app-layout__main > .window-toolbar {
  flex-shrink: 0;
}

.app-layout__content {
  position: relative;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  flex: 1;
}

.app-layout__extension-embed-page {
  position: absolute;
  z-index: 1;
  inset: 0;
}

.app-layout__extension-embed-page--hidden {
  pointer-events: none;
  visibility: hidden;
}

.app-layout__router-view-wrapper {
  display: flex;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.app-layout__extension-embed {
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  border-radius: var(--radius-sm);
}
</style>
