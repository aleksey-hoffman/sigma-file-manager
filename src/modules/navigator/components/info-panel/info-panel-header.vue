<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Component } from 'vue';
import { useNavigatorItemIcon } from '@/composables/use-navigator-item-icon';
import UbuntuWslIcon from '@/components/icons/ubuntu-wsl-icon.vue';
import { isWslPath } from '@/utils/normalize-path';
import type { DirEntry } from '@/types/dir-entry';

const props = defineProps<{
  selectedEntry: DirEntry | null;
}>();

const { t } = useI18n();

const { iconSrc, fallbackIconComponent } = useNavigatorItemIcon({
  path: () => props.selectedEntry?.path ?? '',
  name: () => props.selectedEntry?.name ?? null,
  isDir: () => props.selectedEntry?.is_dir ?? false,
  extension: () => props.selectedEntry?.ext ?? null,
  size: () => 24,
  enabled: () => props.selectedEntry !== null,
});

const entryFallbackIconComponent = computed<Component>(() => {
  if (props.selectedEntry?.is_dir && isWslPath(props.selectedEntry.path)) {
    return UbuntuWslIcon;
  }

  return fallbackIconComponent.value;
});

const rootComponent = computed<Component | 'img'>(() => {
  return iconSrc.value ? 'img' : entryFallbackIconComponent.value;
});

const rootProps = computed<Record<string, unknown>>(() => {
  if (rootComponent.value === 'img') {
    return {
      src: iconSrc.value,
      width: 24,
      height: 24,
      draggable: false,
    };
  }

  return {
    size: 24,
  };
});
</script>

<template>
  <div class="info-panel-header">
    <component
      :is="rootComponent"
      v-bind="rootProps"
      class="info-panel-header__icon"
      :class="{ 'info-panel-header__icon--folder': selectedEntry?.is_dir }"
    />
    <span class="info-panel-header__name">
      {{ selectedEntry?.name || t('noData') }}
    </span>
  </div>
</template>

<style scoped>
.info-panel-header {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid hsl(var(--border));
  gap: 12px;
}

.info-panel-header__icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.info-panel-header__icon--folder {
  color: hsl(var(--primary));
}

.info-panel-header__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
