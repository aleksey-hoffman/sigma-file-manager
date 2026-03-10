<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { Button } from '@/components/ui/button';

type Props = {
  title: string;
  description?: string;
  actionText?: string;
};

type Emits = {
  action: [];
};

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<template>
  <div class="sigma-ui-toaster-default">
    <div class="sigma-ui-toaster-default__title">
      {{ props.title }}
    </div>
    <div
      v-if="props.description"
      class="sigma-ui-toaster-default__description"
    >
      {{ props.description }}
    </div>
    <div
      v-if="props.actionText"
      class="sigma-ui-toaster-default__toolbar"
    >
      <Button
        size="xs"
        @click="emit('action')"
      >
        {{ props.actionText }}
      </Button>
    </div>
  </div>
</template>

<style>
.sigma-ui-toaster-default {
  display: flex;
  width: 100%;
  flex-direction: column;
  padding: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  backdrop-filter: blur(24px);
  background-color: hsl(var(--background) / 50%);
  box-shadow: var(--shadow-md);
  gap: 0.25rem;
  transition: backdrop-filter 160ms ease, background-color 160ms ease;
}

.sigma-ui-toaster-default__title {
  width: 100%;
  font-size: 0.875rem;
  font-weight: 600;
}

.sigma-ui-toaster-default__description {
  overflow: hidden;
  width: 100%;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sigma-ui-toaster-default__toolbar {
  display: flex;
  width: 100%;
  align-items: center;
  padding-top: 0.25rem;
}
</style>
