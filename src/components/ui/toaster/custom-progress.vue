<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts" setup>
import { Button } from '@/components/ui/button';

export type ToastItem = {
  data: {
    id: number | string;
    title: string;
    description: string;
    progress: number;
    timer: number;
    actionText: string;
    cleanup: () => void;
  };
};

type Emits = {
  action: [];
};

const props = defineProps<ToastItem>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div class="sigma-ui-toaster-progress">
    <div class="sigma-ui-toaster-progress__content">
      <div class="sigma-ui-toaster-progress__header">
        {{ props.data.title }}
        <div
          v-if="props.data.progress && props.data.progress < 100"
          class="sigma-ui-toaster-progress__percentage"
        >
          {{ props.data.progress }}%
        </div>
      </div>
      <div class="sigma-ui-toaster-progress__description">
        {{ props.data.description }}
      </div>
      <div class="sigma-ui-toaster-progress__bar">
        <div
          class="sigma-ui-toaster-progress__bar-fill"
          :style="{ width: `${props.data.progress}%` }"
        />
      </div>
    </div>
    <Button
      size="xs"
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
  align-items: flex-end;
  justify-content: space-between;
  padding: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--background));
  box-shadow: var(--shadow-md);
  gap: 1.5rem;
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
