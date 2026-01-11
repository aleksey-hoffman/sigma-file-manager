<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDrives } from '@/modules/home/composables';
import { usePlatformStore } from '@/stores/runtime/platform';
import { Button } from '@/components/ui/button';
import DriveCard from './drive-card.vue';

const { t } = useI18n();
const { drives, isLoading, error, refresh } = useDrives();
const platformStore = usePlatformStore();

const sectionTitle = computed(() => {
  return platformStore.isWindows ? t('drives') : t('locations');
});
</script>

<template>
  <section class="drives-section">
    <h2 class="drives-section__title">
      {{ sectionTitle }}
    </h2>

    <div
      v-if="isLoading"
      class="drives-section__loading"
    >
      <div class="drives-section__spinner" />
      <span>{{ t('loadingDots') }}</span>
    </div>

    <div
      v-else-if="error"
      class="drives-section__error"
    >
      <span>{{ error }}</span>
      <Button
        variant="outline"
        size="sm"
        @click="refresh"
      >
        {{ t('navigator.reloadCurrentDirectory') }}
      </Button>
    </div>

    <div
      v-else-if="drives.length === 0"
      class="drives-section__empty"
    >
      {{ t('placeholders.noDrivesFound') }}
    </div>

    <div
      v-else
      class="drives-section__grid"
    >
      <DriveCard
        v-for="drive in drives"
        :key="drive.path"
        :drive="drive"
      />
    </div>
  </section>
</template>

<style>
.drives-section {
  margin-bottom: 16px;
}

.drives-section__title {
  margin-bottom: 12px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.drives-section__grid {
  display: grid;
  gap: 16px;
  grid-auto-rows: 64px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.drives-section__loading {
  display: flex;
  align-items: center;
  padding: 24px 0;
  color: hsl(var(--muted-foreground));
  gap: 12px;
}

.drives-section__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid hsl(var(--border));
  border-radius: 50%;
  border-top-color: hsl(var(--foreground));
  animation: sigma-ui-spin 0.8s linear infinite;
}

.drives-section__error {
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

.drives-section__empty {
  padding: 32px 16px;
  border: 1px dashed hsl(var(--border));
  border-radius: var(--radius);
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  text-align: center;
}
</style>
