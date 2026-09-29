<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';
import { getPathDisplayName } from '@/utils/normalize-path';
import { isVirtualLocationPath } from '@/utils/virtual-locations';
import { useDashboardEntryPreview } from '@/modules/dashboard/composables/use-dashboard-entry-preview';

const props = withDefaults(defineProps<{
  path: string;
  isFile?: boolean;
  sizeLabel?: string;
  layout?: 'list' | 'grid';
}>(), {
  sizeLabel: '',
  layout: 'list',
});

const emit = defineEmits<{
  click: [];
}>();

const { t } = useI18n();
const slots = useSlots();
const rootRef = ref<HTMLElement | null>(null);

const hasGridFooter = computed(() => {
  return props.layout === 'grid' && (!!slots.meta || !!slots.actions);
});

const itemName = computed(() => {
  if (!props.path) return '';
  return getPathDisplayName(props.path, t) || props.path;
});

const itemDirectory = computed(() => {
  if (!props.path || isVirtualLocationPath(props.path)) return '';
  const lastSlashIndex = props.path.lastIndexOf('/');
  return lastSlashIndex > 0 ? props.path.substring(0, lastSlashIndex) : props.path;
});

const isFile = computed(() => {
  if (isVirtualLocationPath(props.path)) {
    return false;
  }

  return props.isFile === true;
});

const { iconSrc, fallbackIconComponent, thumbnailSrc } = useDashboardEntryPreview({
  path: () => props.path,
  isFile: () => isFile.value,
  rootRef,
});

function handleClick() {
  emit('click');
}
</script>

<template>
  <div
    ref="rootRef"
    class="entry-card"
    :class="`entry-card--${layout}`"
  >
    <button
      type="button"
      class="entry-card__hitbox"
      :aria-label="itemName"
      @click="handleClick"
    />
    <div class="entry-card__icon">
      <img
        v-if="thumbnailSrc"
        class="entry-card__preview"
        :src="thumbnailSrc"
        alt=""
        draggable="false"
      >
      <img
        v-else-if="iconSrc"
        class="entry-card__system-icon"
        :src="iconSrc"
        alt=""
        width="24"
        height="24"
        draggable="false"
      >
      <component
        :is="fallbackIconComponent"
        v-else
        :size="20"
      />
    </div>
    <div class="entry-card__content">
      <div class="entry-card__heading">
        <span class="entry-card__name">{{ itemName }}</span>
        <span
          v-if="sizeLabel"
          class="entry-card__size"
        >{{ sizeLabel }}</span>
      </div>
      <span class="entry-card__path">{{ itemDirectory }}</span>
      <div
        v-if="slots.details"
        class="entry-card__details"
      >
        <slot name="details" />
      </div>
    </div>
    <slot />
    <div
      v-if="hasGridFooter"
      class="entry-card__footer"
    >
      <div class="entry-card__meta">
        <slot name="meta" />
      </div>
      <div
        v-if="slots.actions"
        class="entry-card__actions"
      >
        <slot name="actions" />
      </div>
    </div>
    <div
      v-else-if="slots.actions"
      class="entry-card__actions"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<style>
.entry-card {
  position: relative;
  display: flex;
  overflow: hidden;
  min-width: 0;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  gap: 12px;
  transition: background-color var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.entry-card--grid {
  flex-direction: column;
  align-items: stretch;
  padding: 16px 16px 8px;
  gap: 12px;
}

.entry-card:hover {
  background-color: hsl(var(--muted));
  transition: background-color var(--hover-transition-duration-in);
}

.entry-card:hover .entry-card__action {
  opacity: 1;
  transition: opacity var(--hover-transition-duration-in);
}

.entry-card__hitbox {
  position: absolute;
  padding: 0;
  border: none;
  border-radius: inherit;
  background: none;
  cursor: pointer;
  inset: 0;
}

.entry-card__details,
.entry-card__actions,
.entry-card__action {
  position: relative;
}

.entry-card__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  margin-right: -8px;
  gap: 2px;
}

.entry-card__footer {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid hsl(var(--border));
  margin-top: auto;
  gap: 12px;
}

.entry-card__meta {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  gap: 16px;
  white-space: nowrap;
}

.entry-card__icon {
  display: flex;
  overflow: hidden;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--primary));
}

.entry-card__preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.entry-card__system-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.entry-card__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.entry-card--grid .entry-card__content {
  flex: 0 0 auto;
}

.entry-card__details {
  display: flex;
  min-width: 0;
  align-items: center;
}

.entry-card__heading {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}

.entry-card__name {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  color: hsl(var(--foreground));
  font-size: 0.9rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-card__size {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.entry-card__path {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-card__action {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.entry-card__action:hover {
  color: hsl(var(--destructive));
}

.entry-card__stats {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.entry-card__badge {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  font-weight: 500;
}

.entry-card__time {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
}
</style>
