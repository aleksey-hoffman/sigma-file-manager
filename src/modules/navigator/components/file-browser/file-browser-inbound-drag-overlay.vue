<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CopyIcon, FolderInputIcon } from 'lucide-vue-next';
import type { DragOperationType } from './composables/use-file-browser-drag';

const props = defineProps<{
  isActive: boolean;
  itemCount: number;
  operationType: DragOperationType;
  currentDirLocked: boolean;
  targetingEntry: boolean;
}>();

const { t } = useI18n();

const description = computed(() => {
  if (props.operationType === 'copy') {
    return t('drag.dropToCopyItems', props.itemCount);
  }

  return t('drag.dropToMoveItems', props.itemCount);
});
</script>

<template>
  <Transition name="inbound-drag-overlay">
    <div
      v-if="isActive && (currentDirLocked || !targetingEntry)"
      class="inbound-drag-overlay"
      :class="{ 'inbound-drag-overlay--locked': currentDirLocked }"
    >
      <div class="inbound-drag-overlay__card">
        <div class="inbound-drag-overlay__content">
          <span class="inbound-drag-overlay__description">{{ description }}</span>
          <component
            :is="props.operationType === 'copy' ? CopyIcon : FolderInputIcon"
            :size="16"
            class="inbound-drag-overlay__icon"
          />
        </div>
        <div class="inbound-drag-overlay__hint">
          {{ t('drag.holdShiftToChangeMode') }}
        </div>
        <div class="inbound-drag-overlay__hint">
          {{ t('drag.holdCtrlForCurrentDirDrop') }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.inbound-drag-overlay {
  position: absolute;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed hsl(var(--primary) / 40%);
  border-radius: var(--radius-md);
  inset: 0;
  pointer-events: none;
}

.inbound-drag-overlay--locked {
  background-color: hsl(var(--primary) / 8%);
}

.inbound-drag-overlay__card {
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
}

.inbound-drag-overlay__content {
  display: flex;
  align-items: center;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
  gap: 10px;
}

.inbound-drag-overlay__icon {
  flex-shrink: 0;
  color: hsl(var(--primary));
}

.inbound-drag-overlay__description {
  white-space: nowrap;
}

.inbound-drag-overlay__hint {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.inbound-drag-overlay-enter-active {
  transition:
    opacity 0.15s ease-out,
    transform 0.15s ease-out;
}

.inbound-drag-overlay-leave-active {
  transition:
    opacity 0.2s ease-in,
    transform 0.2s ease-in;
}

.inbound-drag-overlay-enter-from {
  opacity: 0;
  transform: scale(0.97);
}

.inbound-drag-overlay-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
