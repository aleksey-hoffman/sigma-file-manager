<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { WindowToolbar } from './modules/window-toolbar';
import { NavSidebar } from './modules/nav-sidebar';
import { useInit } from './use/init';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { InfusionWrapper } from './components/ui/infusion';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';

const { init } = useInit();
const globalSearchStore = useGlobalSearchStore();
const router = useRouter();

init();

function handleKeydown(event: KeyboardEvent) {
  const isCtrlOrMeta = event.ctrlKey || event.metaKey;
  const normalizedKey = event.key.toLowerCase();

  if (isCtrlOrMeta && event.shiftKey && (event.code === 'KeyF' || normalizedKey === 'f')) {
    event.preventDefault();
    event.stopPropagation();

    if (!globalSearchStore.isOpen) {
      router.push({ name: 'navigator' });
      globalSearchStore.open();
    }
    else {
      globalSearchStore.close();
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown, { capture: true });
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown, { capture: true });
});
</script>

<template>
  <InfusionWrapper />
  <Toaster />
  <TooltipProvider>
    <NavSidebar />
    <div class="app-main">
      <WindowToolbar />
      <RouterView />
    </div>
  </TooltipProvider>
</template>

<style>
#app {
  display: flex;
  height: 100vh;
  background-color: hsl(var(--background-3));
}

.app-main {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: hsl(var(--background-3));
}
</style>
