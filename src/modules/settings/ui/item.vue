<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { Component } from 'vue';

type Props = {
  title: string;
  description?: string;
  icon?: Component;
};

const props = defineProps<Props>();
</script>

<template>
  <div class="settings-view-item">
    <div class="settings-view-item__header">
      <Component
        v-if="props.icon"
        :is="props.icon"
        class="settings-view-item__icon"
        :size="24"
      />
      <div>
        <h3 class="settings-view-item__title">
          {{ props.title }}
        </h3>
        <p
          v-if="props.description"
          class="settings-view-item__description"
        >
          {{ props.description }}
          <slot name="description" />
        </p>
        <slot
          v-if="$slots.description"
          class="settings-view-item__description"
          name="description"
        />
      </div>
    </div>
    <div class="settings-view-item__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.settings-view-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  gap: 2rem;
}

.settings-view-item__header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.settings-view-item__icon {
  flex-shrink: 0;
  color: hsl(var(--icon));
}

.settings-view-item__title {
  margin: 0 0 0.25rem;
  color: hsl(var(--foreground));
  font-size: 1rem;
  font-weight: 600;
}

.settings-view-item__description {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  line-height: 1.4;
}

.settings-view-item__content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
