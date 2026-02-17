<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { Component } from 'vue';

withDefaults(defineProps<{
  icon: Component;
  iconSize?: number;
  title: string;
  description?: string;
  bordered?: boolean;
}>(), {
  iconSize: 48,
  description: '',
  bordered: true,
});
</script>

<template>
  <div
    class="empty-state"
    :class="{ 'empty-state--bordered': bordered }"
  >
    <component
      :is="icon"
      v-if="icon"
      :size="iconSize"
      class="empty-state__icon"
    />
    <p class="empty-state__title">
      {{ title }}
    </p>
    <p
      v-if="description"
      class="empty-state__description"
    >
      {{ description }}
    </p>
  </div>
</template>

<style>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  gap: 16px;
}

.empty-state--bordered {
  border: 1px dashed hsl(var(--border));
  border-radius: var(--radius);
}

.empty-state__icon {
  color: hsl(var(--muted-foreground) / 40%);
}

.empty-state__title {
  color: hsl(var(--foreground));
  font-size: 1.1rem;
  font-weight: 500;
  text-align: center;
}

.empty-state__description {
  max-width: 360px;
  color: hsl(var(--muted-foreground));
  font-size: 0.9rem;
  text-align: center;
}
</style>
