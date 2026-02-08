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
import { EmptyState } from '@/components/ui/empty-state';

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
  <EmptyState
    :icon="iconComponent"
    :title="title"
    :description="description"
  />
</template>
