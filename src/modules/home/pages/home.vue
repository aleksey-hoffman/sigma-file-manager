<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDrives } from '@/modules/home/composables';
import { DriveCard, HomeBanner } from '@/modules/home/components';
import { usePlatformStore } from '@/stores/runtime/platform';

const { t } = useI18n();
const { drives, isLoading, error, refresh } = useDrives();
const platformStore = usePlatformStore();

const locationsTitle = computed(() => {
  return platformStore.isWindows ? t('drives') : t('locations');
});
</script>

<template>
  <div class="home-page">
    <HomeBanner />

    <div class="home-page__content">
      <section class="home-page__section">
        <h2 class="home-page__section-title">
          {{ locationsTitle }}
        </h2>

        <div
          v-if="isLoading"
          class="home-page__loading"
        >
          <div class="home-page__spinner" />
          <span>{{ t('loadingDots') }}</span>
        </div>

        <div
          v-else-if="error"
          class="home-page__error"
        >
          <span>{{ error }}</span>
          <button
            type="button"
            class="home-page__retry-button"
            @click="refresh"
          >
            {{ t('navigator.reloadCurrentDirectory') }}
          </button>
        </div>

        <div
          v-else-if="drives.length === 0"
          class="home-page__empty"
        >
          {{ t('placeholders.noDrivesFound') }}
        </div>

        <div
          v-else
          class="home-page__item-grid"
        >
          <DriveCard
            v-for="drive in drives"
            :key="drive.path"
            :drive="drive"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style>
.home-page {
  height: 100vh;
  padding: 0;
  overflow-y: auto;
  user-select: none;
}

.home-page__content {
  display: flex;
  flex-direction: column;
  padding: 16px 24px;
  gap: 8px;
}

.home-page__section {
  margin-bottom: 16px;
}

.home-page__section-title {
  margin-bottom: 12px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.home-page__item-grid {
  display: grid;
  gap: 16px;
  grid-auto-rows: 64px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.home-page__loading {
  display: flex;
  align-items: center;
  padding: 24px 0;
  color: hsl(var(--muted-foreground));
  gap: 12px;
}

.home-page__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid hsl(var(--border));
  border-radius: 50%;
  border-top-color: hsl(var(--foreground));
  animation: sigma-ui-spin 0.8s linear infinite;
}

.home-page__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 16px;
  border: 1px solid hsl(var(--destructive) / 30%);
  border-radius: var(--radius);
  background-color: hsl(var(--destructive) / 10%);
  color: hsl(var(--destructive));
  font-size: 13px;
  gap: 12px;
}

.home-page__retry-button {
  padding: 6px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.15s ease;
}

.home-page__retry-button:hover {
  background-color: hsl(var(--muted));
}

.home-page__empty {
  padding: 32px 16px;
  border: 1px dashed hsl(var(--border));
  border-radius: var(--radius);
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  text-align: center;
}
</style>
