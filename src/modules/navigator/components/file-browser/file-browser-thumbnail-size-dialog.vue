<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

FORK-MODIFICATION: 缩略图大小四档弹窗（small / medium / large / xlarge）。
详见 docs/superpowers/specs/2026-10-12-navigator-polish-pack-design.md §5.3。
验收反馈 2026-10-12:用户希望增加 54 像素档（xlarge）。
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ThumbnailSize } from './types';

type ThumbnailSizeOption = ThumbnailSize;

const open = defineModel<boolean>('open', { required: true });
const modelValue = defineModel<ThumbnailSizeOption>('modelValue', { required: true });

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();

const options: Array<{ value: ThumbnailSizeOption; descriptionKey: string }> = [
  { value: 'small', descriptionKey: 'settings.general.fileView.thumbnailSizeSmall' },
  { value: 'medium', descriptionKey: 'settings.general.fileView.thumbnailSizeMedium' },
  { value: 'large', descriptionKey: 'settings.general.fileView.thumbnailSizeLarge' },
  { value: 'xlarge', descriptionKey: 'settings.general.fileView.thumbnailSizeXLarge' },
];

function selectOption(size: ThumbnailSizeOption) {
  modelValue.value = size;
  // 立即持久化：与 spec §5.3 一致（"选完后立即更新 setting"）
  void userSettingsStore.set('navigator.thumbnailSize', size);
  // 选完后立即关闭
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="file-browser-thumbnail-size-dialog">
      <DialogHeader>
        <DialogTitle>{{ t('settings.general.fileView.thumbnailSizeTitle') }}</DialogTitle>
        <DialogDescription>
          {{ t('settings.general.fileView.thumbnailSizeDescription') }}
        </DialogDescription>
      </DialogHeader>

      <div class="file-browser-thumbnail-size-dialog__options">
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          class="file-browser-thumbnail-size-dialog__option"
          :class="{
            'file-browser-thumbnail-size-dialog__option--active': modelValue === option.value,
          }"
          :data-test="`thumbnail-size-${option.value}`"
          @click="selectOption(option.value)"
        >
          <span class="file-browser-thumbnail-size-dialog__option-label">
            {{ t(option.descriptionKey) }}
          </span>
          <span
            v-if="modelValue === option.value"
            class="file-browser-thumbnail-size-dialog__option-mark"
            aria-hidden="true"
          >✓</span>
        </button>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="open = false"
        >
          {{ t('cancel') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.file-browser-thumbnail-size-dialog__options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
}

.file-browser-thumbnail-size-dialog__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  background-color: hsl(var(--background));
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.file-browser-thumbnail-size-dialog__option:hover {
  background-color: hsl(var(--muted) / 50%);
}

.file-browser-thumbnail-size-dialog__option--active {
  border-color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
}

.file-browser-thumbnail-size-dialog__option-label {
  font-size: 0.875rem;
}

.file-browser-thumbnail-size-dialog__option-mark {
  color: hsl(var(--primary));
  font-weight: 700;
}
</style>