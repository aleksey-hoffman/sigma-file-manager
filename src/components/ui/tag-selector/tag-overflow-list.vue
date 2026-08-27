<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useResizeObserver } from '@vueuse/core';
import { getTagOverflowVisibleCount, type TagOverflowItem } from './tag-overflow-list';

const props = defineProps<{
  tags: TagOverflowItem[];
  badgeClass?: string;
}>();

const rootRef = ref<HTMLElement | null>(null);
const measureRef = ref<HTMLElement | null>(null);
const visibleCount = ref(props.tags.length);
const hiddenCount = ref(0);

const visibleTags = computed(() => props.tags.slice(0, visibleCount.value));
const tagsMeasureKey = computed(() => {
  return props.tags.map(tag => `${tag.id}\0${tag.name}`).join('\n');
});

function badgeStyle(tag: TagOverflowItem): Record<string, string> | undefined {
  if (tag.style) {
    return tag.style;
  }

  if (!tag.color) {
    return undefined;
  }

  return {
    backgroundColor: `${tag.color}25`,
    color: tag.color,
  };
}

function badgeClassName(options: { canShrink: boolean }): string {
  return [
    'tag-selector__badge',
    'tag-overflow-list__badge',
    options.canShrink ? 'tag-overflow-list__badge--shrink' : '',
    props.badgeClass ?? '',
  ].filter(Boolean).join(' ');
}

function updateOverflow(): void {
  const root = rootRef.value;
  const measure = measureRef.value;

  if (!root || !measure) {
    return;
  }

  const tagElements = [...measure.querySelectorAll<HTMLElement>('[data-tag-overflow-measure]')];
  const moreElement = measure.querySelector<HTMLElement>('[data-tag-overflow-measure-more]');
  const nextOverflow = getTagOverflowVisibleCount({
    tagWidths: tagElements.map(element => Math.ceil(element.getBoundingClientRect().width)),
    moreBadgeWidth: moreElement ? Math.ceil(moreElement.getBoundingClientRect().width) : 0,
    availableWidth: root.clientWidth,
  });

  if (
    nextOverflow.visibleCount === visibleCount.value
    && nextOverflow.hiddenCount === hiddenCount.value
  ) {
    return;
  }

  visibleCount.value = nextOverflow.visibleCount;
  hiddenCount.value = nextOverflow.hiddenCount;
}

useResizeObserver(rootRef, () => {
  updateOverflow();
});

onMounted(() => {
  updateOverflow();
});

watch(tagsMeasureKey, () => {
  visibleCount.value = props.tags.length;
  hiddenCount.value = 0;
  void nextTick(() => {
    updateOverflow();
  });
});
</script>

<template>
  <div
    ref="rootRef"
    class="tag-overflow-list"
  >
    <div
      ref="measureRef"
      class="tag-overflow-list__measure"
      aria-hidden="true"
    >
      <span
        v-for="tag in tags"
        :key="`measure-${tag.id}`"
        class="tag-selector__badge"
        data-tag-overflow-measure
      >{{ tag.name }}</span>
      <span
        class="tag-selector__badge tag-selector__badge--more"
        data-tag-overflow-measure-more
      >+{{ tags.length }}</span>
    </div>

    <div class="tag-overflow-list__visible">
      <span
        v-for="tag in visibleTags"
        :key="tag.id"
        :class="badgeClassName({ canShrink: visibleTags.length === 1 })"
        :style="badgeStyle(tag)"
      >{{ tag.name }}</span>
      <span
        v-if="hiddenCount > 0"
        class="tag-selector__badge tag-selector__badge--more tag-overflow-list__more"
        :class="badgeClass"
      >
        +{{ hiddenCount }}
      </span>
    </div>
  </div>
</template>

<style>
.tag-overflow-list {
  position: relative;
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  align-items: center;
}

.tag-overflow-list__measure {
  position: absolute;
  top: 0;
  display: flex;
  gap: 4px;
  inset-inline-start: 0;
  pointer-events: none;
  visibility: hidden;
  white-space: nowrap;
}

.tag-overflow-list__measure .tag-selector__badge {
  max-width: none;
}

.tag-overflow-list__visible {
  display: flex;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 4px;
}

.tag-overflow-list__badge {
  flex-shrink: 0;
}

.tag-overflow-list__badge--shrink {
  min-width: 0;
  flex-shrink: 1;
}

.tag-overflow-list__more {
  flex-shrink: 0;
}
</style>
