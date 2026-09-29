<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CalendarIcon } from '@lucide/vue';
import { getDefaultFileIconComponent } from '@/modules/navigator/components/file-browser/utils';
import { formatDashboardRelativeTime } from '@/utils/dashboard-relative-time';
import { getPathOrUrlExtension } from '@/utils/remote-file';
import type { TaggedItem } from '@/types/user-stats';

const props = defineProps<{
  item: TaggedItem;
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
