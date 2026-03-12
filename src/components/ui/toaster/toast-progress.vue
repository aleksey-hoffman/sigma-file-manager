<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts" setup>
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import { CopyIcon, FolderInputIcon, Trash2Icon } from 'lucide-vue-next';
import ToastCard from './toast-card.vue';
import ToastHeader from './toast-header.vue';

export type OperationType = 'copy' | 'move' | 'delete' | '';

export type ToastItem = {
  data: {
    id: number | string;
    title: string;
    subtitle?: string;
    description: string;
    downloadSize?: string;
    progress: number;
    timer: number;
    actionText?: string;
    cleanup: () => void;
    operationType?: OperationType;
    itemCount?: number;
    extensionId?: string;
    extensionIconPath?: string;
  };
};

const props = defineProps<ToastItem>();

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
    return 'sigma-ui-toast-progress--delete';
  }

  return '';
});

const descriptionText = computed(() => {
  if (props.data.description && props.data.downloadSize) {
    return `${props.data.description} • ${props.data.downloadSize}`;
  }

  return props.data.downloadSize || props.data.description || '';
});
</script>

<template>
  <ToastCard
    class="sigma-ui-toast-progress"
    :class="operationClass"
  >
    <ToastHeader
      :title="props.data.title"
      :subtitle="props.data.subtitle"
      :item-count="props.data.itemCount"
      :extension-id="props.data.extensionId"
      :extension-icon-path="props.data.extensionIconPath"
    >
      <template
        v-if="operationIcon"
        #leading
      >
        <component
          :is="operationIcon"
          :size="16"
          class="sigma-ui-toast-progress__icon"
        />
      </template>
      <template
        v-if="props.data.progress && props.data.progress < 100"
        #trailing
      >
        <div class="sigma-ui-toast-progress__percentage">
          {{ props.data.progress }}%
        </div>
      </template>
    </ToastHeader>
    <div
      v-if="props.data.description || props.data.downloadSize"
      class="sigma-ui-toast-progress__description"
    >
      {{ descriptionText }}
    </div>
    <div
      v-if="props.data.progress > 0 && props.data.progress < 100"
      class="sigma-ui-toast-progress__bar"
    >
      <div
        class="sigma-ui-toast-progress__bar-fill"
        :style="{ width: `${props.data.progress}%` }"
      />
    </div>
    <div
      v-if="props.data.actionText"
      class="sigma-ui-toast-progress__toolbar"
    >
      <Button
        size="xs"
        variant="secondary"
        @click="props.data.cleanup"
      >
        {{ props.data.actionText }}
      </Button>
    </div>
  </ToastCard>
</template>

<style>
.sigma-ui-toast-progress--delete .sigma-ui-toast-progress__icon {
  color: hsl(var(--warning));
}

.sigma-ui-toast-progress__toolbar {
  display: flex;
  width: 100%;
  align-items: center;
  padding-top: 0.25rem;
}

.sigma-ui-toast-progress__icon {
  flex-shrink: 0;
  color: hsl(var(--primary));
}

.sigma-ui-toast-progress__percentage {
  display: inline-flex;
  flex-shrink: 0;
  margin-left: auto;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  white-space: nowrap;
}

.sigma-ui-toast-progress__description {
  overflow: hidden;
  color: hsl(var(--foreground) / 45%);
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sigma-ui-toast-progress__bar {
  width: 100%;
  height: 2px;
  border-radius: var(--rounded-full);
  background-color: hsl(var(--primary) / 10%);
  font-size: 0.875rem;
}

.sigma-ui-toast-progress__bar-fill {
  height: 2px;
  border-radius: var(--rounded-full);
  background-color: hsl(var(--primary));
  transition: width 200ms ease-out;
}
</style>
