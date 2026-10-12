<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { CircleAlertIcon, ImagesIcon, LoaderCircleIcon, Trash2Icon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { SettingsItem } from '@/modules/settings';
import { formatBytes } from '@/modules/navigator/components/file-browser/utils';

const { t } = useI18n();

const sizeBytes = ref<number | null>(null);
const itemCount = ref<number | null>(null);
const isLoading = ref(false);
const isClearing = ref(false);
const isConfirmDialogOpen = ref(false);
const errorMessage = ref<string | null>(null);

const displaySize = computed(() =>
  sizeBytes.value === null ? t('settings.storage.thumbnailCache.sizeUnknown') : formatBytes(sizeBytes.value),
);

const displayItemCount = computed(() =>
  itemCount.value === null ? t('settings.storage.thumbnailCache.countUnknown') : String(itemCount.value),
);

async function refresh() {
  isLoading.value = true;

  try {
    const stats = await invoke<{
      itemCount: number;
      sizeBytes: number;
    }>('get_thumbnail_cache_stats');

    itemCount.value = stats.itemCount;
    sizeBytes.value = stats.sizeBytes;
    errorMessage.value = null;
  }
  catch (error) {
    // 读不到统计时不能把上一次的数字继续显示成「当前占用」，
    // 否则用户点清理之后看到的仍是旧值，会以为清理没生效。
    itemCount.value = null;
    sizeBytes.value = null;
    errorMessage.value = String(error);
  }
  finally {
    isLoading.value = false;
  }
}

function openConfirmDialog() {
  isConfirmDialogOpen.value = true;
}

async function clearCache() {
  isClearing.value = true;

  try {
    await invoke('clear_thumbnail_cache');
    isConfirmDialogOpen.value = false;
    await refresh();
    toast.success(t('settings.storage.thumbnailCache.clearSuccess'));
  }
  catch (error) {
    errorMessage.value = String(error);
    toast.error(t('settings.storage.thumbnailCache.clearFailed'));
  }
  finally {
    isClearing.value = false;
  }
}

onMounted(refresh);
</script>

<template>
  <SettingsItem
    :title="t('settings.storage.thumbnailCache.title')"
    :description="t('settings.storage.thumbnailCache.description')"
    :icon="ImagesIcon"
  >
    <div class="thumbnail-cache__stats">
      <div class="thumbnail-cache__stat">
        <span class="thumbnail-cache__stat-label">
          {{ t('settings.storage.thumbnailCache.sizeLabel') }}
        </span>
        <span class="thumbnail-cache__stat-value">
          <LoaderCircleIcon
            v-if="isLoading"
            :size="14"
            class="thumbnail-cache__spinner"
          />
          <template v-else>
            {{ displaySize }}
          </template>
        </span>
      </div>

      <div class="thumbnail-cache__stat">
        <span class="thumbnail-cache__stat-label">
          {{ t('settings.storage.thumbnailCache.countLabel') }}
        </span>
        <span class="thumbnail-cache__stat-value">
          {{ displayItemCount }}
        </span>
      </div>
    </div>

    <div class="thumbnail-cache__actions">
      <Button
        variant="outline"
        size="sm"
        :disabled="isClearing"
        @click="openConfirmDialog"
      >
        <Trash2Icon :size="14" />
        {{ t('settings.storage.thumbnailCache.clear') }}
      </Button>
    </div>

    <div
      v-if="errorMessage"
      class="thumbnail-cache__error"
    >
      <CircleAlertIcon
        :size="14"
        class="thumbnail-cache__error-icon"
      />
      <span>{{ errorMessage }}</span>
    </div>

    <Dialog v-model:open="isConfirmDialogOpen">
      <DialogContent class="thumbnail-cache__confirm-dialog">
        <DialogHeader>
          <DialogTitle>
            {{ t('settings.storage.thumbnailCache.confirmTitle') }}
          </DialogTitle>
          <DialogDescription>
            {{ t('settings.storage.thumbnailCache.confirmDescription') }}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            :disabled="isClearing"
            @click="isConfirmDialogOpen = false"
          >
            {{ t('cancel') }}
          </Button>
          <Button
            variant="destructive"
            :disabled="isClearing"
            @click="clearCache"
          >
            <LoaderCircleIcon
              v-if="isClearing"
              :size="14"
              class="thumbnail-cache__spinner"
            />
            <Trash2Icon
              v-else
              :size="14"
            />
            {{ t('settings.storage.thumbnailCache.clear') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </SettingsItem>
</template>

<style scoped>
.thumbnail-cache__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 2rem;
}

.thumbnail-cache__stat {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.thumbnail-cache__stat-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.thumbnail-cache__stat-value {
  display: inline-flex;
  align-items: center;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-weight: 600;
  gap: 0.375rem;
}

.thumbnail-cache__spinner {
  animation: thumbnail-cache-spin 1s linear infinite;
}

@keyframes thumbnail-cache-spin {
  to {
    transform: rotate(360deg);
  }
}

.thumbnail-cache__actions {
  display: flex;
  align-items: center;
}

.thumbnail-cache__error {
  display: flex;
  align-items: flex-start;
  color: hsl(var(--destructive));
  font-size: 0.75rem;
  gap: 0.375rem;
}

.thumbnail-cache__error-icon {
  flex-shrink: 0;
  margin-top: 0.125rem;
}
</style>
