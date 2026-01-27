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
</script>

<template>
  <InfusionWrapper />
  <Toaster />
  <ChangelogDialog />
  <TooltipProvider>
    <NavSidebar />
    <div class="app-layout__main">
      <WindowToolbar />
      <RouterView />
    </div>
  </TooltipProvider>
</template>

<style>
.app-layout__main {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: hsl(var(--background-3));
}
</style>
