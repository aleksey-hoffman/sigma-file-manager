<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CopyIcon, FolderInputIcon } from 'lucide-vue-next';
import type { DragOperationType } from './composables/use-file-browser-drag';
import { UI_CONSTANTS } from '@/constants';

const props = defineProps<{
  isActive: boolean;
  itemCount: number;
  operationType: DragOperationType;
  cursorX: number;
  cursorY: number;
}>();

const { t } = useI18n();

const overlayStyle = computed(() => ({
  left: `${props.cursorX + UI_CONSTANTS.DRAG_OVERLAY_OFFSET_X}px`,
  top: `${props.cursorY + UI_CONSTANTS.DRAG_OVERLAY_OFFSET_Y}px`,
}));

const description = computed(() => {
  if (props.operationType === 'copy') {
    return t('drag.copyItems', { count: props.itemCount });
  }

  return t('drag.moveItems', { count: props.itemCount });
});
</script>

<template>
  <Teleport to="body">
    <Transition name="file-browser-drag-overlay">
      <div
        v-if="props.isActive"
        class="file-browser-drag-overlay"
        :style="overlayStyle"
      >
        <div class="file-browser-drag-overlay__content">
          <span class="file-browser-drag-overlay__description">{{ description }}</span>
          <component
            :is="props.operationType === 'copy' ? CopyIcon : FolderInputIcon"
            :size="16"
            class="file-browser-drag-overlay__icon"
          />
        </div>
        <div class="file-browser-drag-overlay__hint">
          {{ t('drag.holdShiftToChangeMode') }}
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.file-browser-drag-overlay {
  position: fixed;
  z-index: 90;
  display: flex;
  flex-direction: column;
  padding: 8px 16px;
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: var(--radius-md);
  backdrop-filter: blur(12px);
  background-color: hsl(var(--background) / 80%);
  box-shadow:
    0 8px 32px hsl(0deg 0% 0% / 25%),
    0 2px 8px hsl(0deg 0% 0% / 10%);
  gap: 4px;
  pointer-events: none;
  white-space: nowrap;
}

.file-browser-drag-overlay__content {
  display: flex;
  align-items: center;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
  gap: 10px;
}

.file-browser-drag-overlay__icon {
  flex-shrink: 0;
  color: hsl(var(--primary));
}

.file-browser-drag-overlay__hint {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.file-browser-drag-overlay-enter-active {
  transition:
    opacity 0.15s ease-out,
    transform 0.15s ease-out;
}

.file-browser-drag-overlay-leave-active {
  transition:
    opacity 0.2s ease-in,
    transform 0.2s ease-in;
}

.file-browser-drag-overlay-enter-from {
  opacity: 0;
  transform: scale(0.85);
}

.file-browser-drag-overlay-leave-to {
  opacity: 0;
  transform: scale(0.85) translateX(-16px) translateY(-8px);
}
</style>
