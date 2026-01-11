<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, type Component } from 'vue';
import {
  StarIcon,
  TagIcon,
  TrendingUpIcon,
  ClockIcon,
} from 'lucide-vue-next';

type EmptyStateType = 'favorites' | 'tagged' | 'frequent' | 'history';

const props = defineProps<{
  type: EmptyStateType;
  title: string;
  description: string;
}>();

const iconComponents: Record<EmptyStateType, Component> = {
  favorites: StarIcon,
  tagged: TagIcon,
  frequent: TrendingUpIcon,
  history: ClockIcon,
};

const iconComponent = computed(() => iconComponents[props.type]);
</script>

<template>
  <div class="dashboard-empty-state">
    <component
      :is="iconComponent"
      :size="48"
      class="dashboard-empty-state__icon"
    />
    <p class="dashboard-empty-state__title">
      {{ title }}
    </p>
    <p class="dashboard-empty-state__description">
      {{ description }}
    </p>
  </div>
</template>

<style>
.dashboard-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  border: 1px dashed hsl(var(--border));
  border-radius: var(--radius);
  gap: 16px;
}

.dashboard-empty-state__icon {
  color: hsl(var(--muted-foreground) / 40%);
}

.dashboard-empty-state__title {
  color: hsl(var(--foreground));
  font-size: 1.1rem;
  font-weight: 500;
}

.dashboard-empty-state__description {
  max-width: 360px;
  color: hsl(var(--muted-foreground));
  font-size: 0.9rem;
  text-align: center;
}
</style>
