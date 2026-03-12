<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { WindowToolbar } from '@/modules/window-toolbar';
import { NavSidebar } from '@/modules/nav-sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { InfusionWrapper } from '@/components/ui/infusion';
import { ChangelogDialog } from '@/modules/changelog';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import ExtensionDialog from '@/modules/extensions/components/extension-dialog.vue';
import CommandPalette from '@/modules/extensions/components/command-palette.vue';
import ExtensionModalsContainer from '@/modules/extensions/components/extension-modals-container.vue';

const userSettingsStore = useUserSettingsStore();
</script>

<template>
  <div
    class="app-layout"
    :style="{ '--font': userSettingsStore.defaultFontFamily }"
  >
    <InfusionWrapper />
    <Toaster />
    <ChangelogDialog />
    <ExtensionDialog />
    <CommandPalette />
    <ExtensionModalsContainer />
    <TooltipProvider>
      <NavSidebar />
      <div class="app-layout__main">
        <WindowToolbar />
        <div class="app-layout__content">
          <RouterView
            v-slot="{ Component }"
            data-vaul-drawer-wrapper
          >
            <KeepAlive :include="['ExtensionPage']">
              <component
                :is="Component"
                :key="$route.name === 'extension-page' ? $route.params.fullPageId : $route.fullPath"
              />
            </KeepAlive>
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
  overflow: hidden;
  min-height: 0;
  flex: 1;
}
</style>
