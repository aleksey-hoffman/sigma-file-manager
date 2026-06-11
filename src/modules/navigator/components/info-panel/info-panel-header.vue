<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Component } from 'vue';
import { Minimize2Icon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigatorItemIcon } from '@/composables/use-navigator-item-icon';
import UbuntuWslIcon from '@/components/icons/ubuntu-wsl-icon.vue';
import { isWslPath } from '@/utils/normalize-path';
import type { DirEntry } from '@/types/dir-entry';
import { useInfoPanelLayout } from './composables/use-info-panel-layout';

const props = withDefaults(defineProps<{
  selectedEntry: DirEntry | null;
  showResetButton?: boolean;
}>(), {
  showResetButton: true,
});

const emit = defineEmits<{
  'reset-layout': [];
}>();

const { t } = useI18n();
const { hasCustomPanelSizes } = useInfoPanelLayout();

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
    <div
      v-if="props.showResetButton && hasCustomPanelSizes"
      class="info-panel-header__actions"
    >
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            size="xs"
            variant="ghost"
            class="info-panel-header__reset-btn animate-fade-in"
            @click="emit('reset-layout')"
          >
            <Minimize2Icon :size="14" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ t('settings.infoPanel.resetSize') }}
        </TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>

<style scoped>
.info-panel-header {
  display: flex;
  height: 60px;
  min-height: 60px;
  flex-shrink: 0;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid hsl(var(--border));
  gap: 12px;
}

.info-panel-header__actions {
  display: flex;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
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
  min-width: 0;
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-panel-header__reset-btn {
  flex-shrink: 0;
  animation: none;
  color: hsl(var(--muted-foreground));
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}
</style>

<style>
.info-panel-hover-reveal:hover .info-panel-header__reset-btn,
.info-panel-hover-reveal:focus-within .info-panel-header__reset-btn,
.info-panel-header__reset-btn:focus-visible {
  animation: sigma-ui-fade-in var(--animate-fade-in-duration, 0.5s) ease;
  opacity: 1;
  pointer-events: auto;
  transition: opacity var(--hover-transition-duration-in);
}
</style>
