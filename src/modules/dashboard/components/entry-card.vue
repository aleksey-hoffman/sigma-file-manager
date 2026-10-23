<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!-- FORK-MODIFICATION 2026-10-23：移植自 upstream `3eca4c17`（仪表盘重设计）的「给卡片加信息」部分。
     三处改动，都不改变卡片原有的点击行为与插槽结构：
       1. `sizeLabel` —— 文件名右侧显示条目大小；
       2. 缩略图 —— 图片/视频进入视口后显示真实缩略图，没有缩略图就落回原来的图标；
       3. `#meta` 插槽 —— 路径下面多一行元信息（类型 + 相对时间）。
     upstream 那一版把整张卡片换成了「div + 绝对定位 hitbox」并引入了 list/grid 两种布局，
     那是骨架级替换，不在本次范围内。 -->

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderIcon, FileIcon, HardDriveIcon } from '@lucide/vue';
import { getPathDisplayName } from '@/utils/normalize-path';
import { isVirtualLocationPath } from '@/utils/virtual-locations';
import { useDashboardEntryPreview } from '@/modules/dashboard/composables/use-dashboard-entry-preview';

const props = withDefaults(defineProps<{
  path: string;
  isFile?: boolean;
  sizeLabel?: string;
}>(), {
  sizeLabel: '',
});

const emit = defineEmits<{
  click: [];
}>();

const { t } = useI18n();
const slots = useSlots();
const rootRef = ref<HTMLElement | null>(null);

const hasFooter = computed(() => !!slots.footer);

const itemName = computed(() => {
  if (!props.path) return '';
  return getPathDisplayName(props.path, t) || props.path;
});

const itemDirectory = computed(() => {
  if (!props.path || isVirtualLocationPath(props.path)) return '';
  const lastSlashIndex = props.path.lastIndexOf('/');
  return lastSlashIndex > 0 ? props.path.substring(0, lastSlashIndex) : props.path;
});

const isDirectory = computed(() => {
  if (isVirtualLocationPath(props.path)) {
    return true;
  }

  if (props.isFile !== undefined) {
    return !props.isFile;
  }

  return props.path.endsWith('/') || !props.path.includes('.');
});

const showLocationsIcon = computed(() => isVirtualLocationPath(props.path));

const { thumbnailSrc } = useDashboardEntryPreview({
  path: () => props.path,
  isFile: () => !isDirectory.value,
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
    :class="{ 'entry-card--with-footer': hasFooter }"
  >
    <button
      type="button"
      class="entry-card__main"
      @click="handleClick"
    >
      <div class="entry-card__icon">
        <img
          v-if="thumbnailSrc"
          class="entry-card__preview"
          :src="thumbnailSrc"
          alt=""
          draggable="false"
        >
        <HardDriveIcon
          v-else-if="showLocationsIcon"
          :size="20"
        />
        <FolderIcon
          v-else-if="isDirectory"
          :size="20"
        />
        <FileIcon
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
          v-if="slots.meta"
          class="entry-card__meta"
        >
          <slot name="meta" />
        </div>
      </div>
      <slot />
    </button>
    <div
      v-if="hasFooter"
      class="entry-card__footer"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<style>
.entry-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  transition: background-color var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.entry-card:hover {
  background-color: hsl(var(--muted));
  transition: background-color var(--hover-transition-duration-in);
}

.entry-card:hover .entry-card__action {
  opacity: 1;
  transition: opacity var(--hover-transition-duration-in);
}

.entry-card__main {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 12px 16px;
  border: none;
  background: none;
  cursor: pointer;
  gap: 12px;
  text-align: left;
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

.entry-card__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
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

.entry-card__meta {
  display: flex;
  overflow: hidden;
  min-width: 0;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  gap: 16px;
  white-space: nowrap;
}

.entry-card__footer {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  padding: 0 16px 8px;
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
