<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

const { t } = useI18n();
</script>

<template>
  <ScrollArea class="file-browser-loading">
    <div class="file-browser-loading__header">
      <span class="file-browser-loading__header-name">{{ t('fileBrowser.name') }}</span>
      <span class="file-browser-loading__header-size">{{ t('fileBrowser.size') }}</span>
      <span class="file-browser-loading__header-modified">{{ t('fileBrowser.modified') }}</span>
    </div>
    <div class="file-browser-loading__list">
      <div
        v-for="skeletonIndex in 12"
        :key="skeletonIndex"
        class="file-browser-loading__row"
      >
        <div class="file-browser-loading__name">
          <Skeleton class="file-browser-loading__icon" />
          <Skeleton class="file-browser-loading__text" />
        </div>
        <Skeleton class="file-browser-loading__size" />
        <Skeleton class="file-browser-loading__modified" />
      </div>
    </div>
  </ScrollArea>
</template>

<style scoped>
.file-browser-loading {
  animation: sigma-ui-fade-in 1s ease-out;
}

.file-browser-loading__header {
  position: sticky;
  z-index: 1;
  top: 0;
  display: grid;
  padding: 10px 16px;
  border-bottom: 1px solid hsl(var(--border));
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--background-3) / 90%);
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  grid-template-columns: minmax(80px, 1fr) minmax(50px, 100px) minmax(60px, 140px);
  text-transform: uppercase;
}

.file-browser-loading__list {
  display: flex;
  flex-direction: column;
}

.file-browser-loading__row {
  display: grid;
  padding: 10px 16px;
  grid-template-columns: minmax(80px, 1fr) minmax(50px, 100px) minmax(60px, 140px);
}

.file-browser-loading__name {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-browser-loading__icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
}

.file-browser-loading__text {
  width: 60%;
  height: 14px;
  border-radius: 4px;
}

.file-browser-loading__size {
  width: 50px;
  height: 14px;
  border-radius: 4px;
}

.file-browser-loading__modified {
  width: 100px;
  height: 14px;
  border-radius: 4px;
}
</style>
