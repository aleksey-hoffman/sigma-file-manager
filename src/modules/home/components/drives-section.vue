<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PlusIcon } from '@lucide/vue';
import { useDrives } from '@/modules/home/composables';
import { usePlatformStore } from '@/stores/runtime/platform';
import { Button } from '@/components/ui/button';
import { DirEntryInteractive } from '@/components/dir-entry-interactive';
import DriveCard from './drive-card.vue';
import MountDialog from './mount-dialog.vue';
import { getStaggerSlideUpBinding } from '@/utils/stagger-animation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const { t } = useI18n();
const { drives, isLoading, error, refresh } = useDrives();
const platformStore = usePlatformStore();

const showMountDialog = ref(false);

const sectionTitle = computed(() => {
  return platformStore.isWindows ? t('drives') : t('locations');
});
</script>

<template>
  <section class="drives-section">
    <div class="drives-section__header">
      <h2 class="drives-section__title">
        {{ sectionTitle }}
      </h2>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            class="drives-section__add-button"
            variant="outline"
            size="xs"
            @click="showMountDialog = true"
          >
            <PlusIcon :size="14" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('mountableDevices') }}</TooltipContent>
      </Tooltip>
      <Tooltip />
    </div>

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
      <DirEntryInteractive
        v-for="(drive, itemIndex) in drives"
        :key="drive.path"
        :path="drive.path"
      >
        <DriveCard
          v-bind="getStaggerSlideUpBinding(itemIndex)"
          :drive="drive"
        />
      </DirEntryInteractive>
    </div>

    <MountDialog
      :open="showMountDialog"
      @update:open="showMountDialog = $event"
    />
  </section>
</template>

<style>
.drives-section {
  margin-bottom: 16px;
}

.drives-section__header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.drives-section__title {
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.drives-section__add-button {
  opacity: 0;
  transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.drives-section:hover .drives-section__add-button,
.drives-section:focus-within .drives-section__add-button {
  opacity: 1;
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

.drives-section__grid .dir-entry-interactive {
  border-radius: var(--radius);
  transition: box-shadow 0.15s ease, background-color 0.15s ease;
}

.drives-section__grid .dir-entry-interactive[data-drag-over] {
  background-color: hsl(var(--primary) / 8%);
  box-shadow: inset 0 0 0 2px hsl(var(--primary) / 60%);
}
</style>
