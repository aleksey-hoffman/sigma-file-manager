<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { onMounted } from 'vue';
import { SettingsHeader, SettingsContent, SettingsSearch, SettingsActions } from '@/modules/settings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSettingsStore } from '@/stores/runtime/settings';

const settingsStore = useSettingsStore();

onMounted(() => {
  settingsStore.init();
});
</script>

<template>
  <div class="settings-page">
    <ScrollArea>
      <SettingsActions />
      <SettingsSearch />
      <SettingsHeader />
      <SettingsContent />
    </ScrollArea>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  height: calc(100vh - var(--window-toolbar-height));
  flex-direction: column;
  color: hsl(var(--foreground));
  overflow-y: auto;
}
</style>
