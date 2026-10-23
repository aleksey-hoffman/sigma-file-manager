<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!-- FORK-MODIFICATION 2026-10-23：移植自 upstream `3eca4c17`（仪表盘重设计）。
     条目卡片底部的一行元信息：类型（文件夹 / JPG）+ 相对时间（5 hours ago）。 -->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CalendarIcon } from '@lucide/vue';
import { getDefaultFileIconComponent } from '@/modules/navigator/components/file-browser/utils';
import { formatDashboardRelativeTime } from '@/utils/dashboard-relative-time';
import { getPathOrUrlExtension } from '@/utils/remote-file';

const props = defineProps<{
  // FORK-MODIFICATION 2026-10-23：upstream 绑的是 `TaggedItem`（多一个 tagIds 字段），
  // 本仓这个组件同时给「收藏」和「标记」两个页签用，所以只要求**最小结构**：
  // 路径 + 是不是文件 + 何时加入。两个类型都满足。
  item: {
    path: string;
    isFile: boolean;
    addedAt: number;
  };
}>();

const { t } = useI18n();

const fileExtension = computed(() => {
  return props.item.isFile ? getPathOrUrlExtension(props.item.path) : '';
});

const kindIcon = computed(() => {
  return getDefaultFileIconComponent({
    isDirectory: !props.item.isFile,
    extension: fileExtension.value,
  });
});

const kindLabel = computed(() => {
  if (!props.item.isFile) {
    return t('fileBrowser.kinds.folder');
  }

  return fileExtension.value ? fileExtension.value.toUpperCase() : t('fileBrowser.kinds.file');
});

const addedTimeLabel = computed(() => {
  return formatDashboardRelativeTime(props.item.addedAt, (key, count) => {
    return count === undefined ? t(key) : t(key, count);
  });
});
</script>

<template>
  <span class="dashboard-tagged-item-meta__entry">
    <component
      :is="kindIcon"
      :size="14"
    />
    <span class="dashboard-tagged-item-meta__text">{{ kindLabel }}</span>
  </span>
  <span class="dashboard-tagged-item-meta__entry">
    <CalendarIcon :size="14" />
    <span class="dashboard-tagged-item-meta__text">{{ addedTimeLabel }}</span>
  </span>
</template>

<style>
.dashboard-tagged-item-meta__entry {
  display: inline-flex;
  min-width: 0;
  flex-shrink: 1;
  align-items: center;
  gap: 6px;
}

.dashboard-tagged-item-meta__entry svg {
  flex-shrink: 0;
}

.dashboard-tagged-item-meta__text {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
