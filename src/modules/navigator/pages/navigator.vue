<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { TabBar } from '@/modules/tab-bar';
import { ScrollArea } from '@/components/ui/scroll-area';
</script>

<template>
  <div class="navigator-page">
    <ScrollArea>
      <TabBar />
    </ScrollArea>
  </div>
</template>

<style scoped>
.navigator-page {
  display: flex;
  height: calc(100vh - var(--window-toolbar-height));
  flex-direction: column;
  color: hsl(var(--foreground));
  overflow-y: auto;
}
</style>
