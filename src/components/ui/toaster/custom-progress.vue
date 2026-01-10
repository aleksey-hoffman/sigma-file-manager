<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { CopyIcon, FolderInputIcon, Trash2Icon } from 'lucide-vue-next';

export type OperationType = 'copy' | 'move' | 'delete' | '';

export type ToastItem = {
  data: {
    id: number | string;
    title: string;
    description: string;
    progress: number;
    timer: number;
    actionText: string;
    cleanup: () => void;
    operationType?: OperationType;
    itemCount?: number;
  };
};

type Emits = {
  action: [];
};

const props = defineProps<ToastItem>();
const emit = defineEmits<Emits>();
const { t } = useI18n();

const operationIcon = computed(() => {
  switch (props.data.operationType) {
    case 'copy':
      return CopyIcon;
    case 'move':
      return FolderInputIcon;
    case 'delete':
      return Trash2Icon;
    default:
      return null;
  }
});

const operationClass = computed(() => {
  if (props.data.operationType === 'delete') {
    return 'sigma-ui-toaster-progress--delete';
  }

  return '';
});
</script>

<template>
  <div
    class="sigma-ui-toaster-progress"
    :class="operationClass"
  >
    <div class="sigma-ui-toaster-progress__content">
      <div class="sigma-ui-toaster-progress__header">
        <component
          :is="operationIcon"
          v-if="operationIcon"
          :size="16"
          class="sigma-ui-toaster-progress__icon"
        />
        {{ props.data.title }}
        <span
          v-if="props.data.itemCount"
          class="sigma-ui-toaster-progress__count-tag"
        >
          {{ t('item', props.data.itemCount) }}
        </span>
        <div
          v-if="props.data.progress && props.data.progress < 100"
          class="sigma-ui-toaster-progress__percentage"
        >
          {{ props.data.progress }}%
        </div>
      </div>
      <div
        v-if="props.data.description"
        class="sigma-ui-toaster-progress__description"
      >
        {{ props.data.description }}
      </div>
      <div
        v-if="props.data.progress > 0 && props.data.progress < 100"
        class="sigma-ui-toaster-progress__bar"
      >
        <div
          class="sigma-ui-toaster-progress__bar-fill"
          :style="{ width: `${props.data.progress}%` }"
        />
      </div>
    </div>
    <Button
      size="xs"
      variant="secondary"
      @click="emit('action')"
    >
      {{ props.data.actionText }}
    </Button>
  </div>
</template>

<style>
.sigma-ui-toaster-progress {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  backdrop-filter: blur(24px);
  background-color: hsl(var(--background) / 50%);
  box-shadow: var(--shadow-md);
  gap: 1.5rem;
  transition: backdrop-filter 160ms ease, background-color 160ms ease;
}

.sigma-ui-toaster-progress--delete .sigma-ui-toaster-progress__icon {
  color: hsl(var(--warning));
}

.sigma-ui-toaster-progress__content {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.sigma-ui-toaster-progress__header {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 600;
  gap: 0.5rem;
}

.sigma-ui-toaster-progress__icon {
  flex-shrink: 0;
  color: hsl(var(--primary));
}

.sigma-ui-toaster-progress__count-tag {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(var(--muted));
  font-size: 0.75rem;
  font-weight: 500;
}

.sigma-ui-toaster-progress__percentage {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.sigma-ui-toaster-progress__description {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.sigma-ui-toaster-progress__bar {
  width: 100%;
  height: 2px;
  border-radius: var(--rounded-full);
  margin-top: 0.5rem;
  background-color: hsl(var(--primary) / 10%);
  font-size: 0.875rem;
}

.sigma-ui-toaster-progress__bar-fill {
  height: 2px;
  border-radius: var(--rounded-full);
  background-color: hsl(var(--primary));
}
</style>
