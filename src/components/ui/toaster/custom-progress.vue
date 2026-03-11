<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { CopyIcon, FolderInputIcon, Trash2Icon } from 'lucide-vue-next';
import ExtensionIcon from '@/modules/extensions/components/extension-icon.vue';

export type OperationType = 'copy' | 'move' | 'delete' | '';

export type ToastItem = {
  data: {
    id: number | string;
    title: string;
    subtitle?: string;
    description: string;
    downloadSize?: string;
    progress: number;
    timer: number;
    actionText: string;
    cleanup: () => void;
    operationType?: OperationType;
    itemCount?: number;
    extensionId?: string;
    extensionIconPath?: string;
  };
};

const props = defineProps<ToastItem>();
const { t } = useI18n();

const operationIcon = computed(() => {
  switch (props.data.operationType) {
    case 'copy':
      return CopyIcon;
    case 'move':
      return FolderInputIcon;
    case 'delete':
      return Trash2Icon;
    default:
      return null;
  }
});

const operationClass = computed(() => {
  if (props.data.operationType === 'delete') {
    return 'sigma-ui-toaster-progress--delete';
  }

  return '';
});

const formattedTitle = computed(() => {
  const titleText = props.data.title ?? '';
  const separatorIndex = titleText.indexOf('|');

  if (separatorIndex === -1) {
    return {
      prefix: titleText,
      badge: '',
      hasBadge: false,
    };
  }

  const prefixText = titleText.slice(0, separatorIndex).trim();
  const badgeText = titleText.slice(separatorIndex + 1).trim();

  if (!prefixText || !badgeText) {
    return {
      prefix: titleText,
      badge: '',
      hasBadge: false,
    };
  }

  return {
    prefix: prefixText,
    badge: badgeText,
    hasBadge: true,
  };
});

const descriptionText = computed(() => {
  if (props.data.description && props.data.downloadSize) {
    return `${props.data.description} • ${props.data.downloadSize}`;
  }

  return props.data.downloadSize || props.data.description || '';
});
</script>

<template>
  <div
    class="sigma-ui-toaster-progress"
    :class="operationClass"
  >
    <div class="sigma-ui-toaster-progress__header">
      <component
        :is="operationIcon"
        v-if="operationIcon"
        :size="16"
        class="sigma-ui-toaster-progress__icon"
      />
      <span class="sigma-ui-toaster-progress__title-prefix">
        {{ formattedTitle.prefix }}
      </span>
      <span
        v-if="formattedTitle.hasBadge"
        class="sigma-ui-toaster-progress__title-badge"
      >
        <ExtensionIcon
          v-if="props.data.extensionId"
          :extension-id="props.data.extensionId"
          :icon-path="props.data.extensionIconPath"
          :size="12"
        />
        {{ formattedTitle.badge }}
      </span>
      <span
        v-if="props.data.itemCount"
        class="sigma-ui-toaster-progress__count-tag"
      >
        {{ t('item', props.data.itemCount) }}
      </span>
      <div
        v-if="props.data.progress && props.data.progress < 100"
        class="sigma-ui-toaster-progress__percentage"
      >
        {{ props.data.progress }}%
      </div>
    </div>
    <div
      v-if="props.data.subtitle"
      class="sigma-ui-toaster-progress__subtitle"
    >
      {{ props.data.subtitle }}
    </div>
    <div
      v-if="props.data.description || props.data.downloadSize"
      class="sigma-ui-toaster-progress__description"
    >
      {{ descriptionText }}
    </div>
    <div
      v-if="props.data.progress > 0 && props.data.progress < 100"
      class="sigma-ui-toaster-progress__bar"
    >
      <div
        class="sigma-ui-toaster-progress__bar-fill"
        :style="{ width: `${props.data.progress}%` }"
      />
    </div>
    <div
      v-if="props.data.actionText"
      class="sigma-ui-toaster-progress__toolbar"
    >
      <Button
        size="xs"
        variant="secondary"
        @click="props.data.cleanup"
      >
        {{ props.data.actionText }}
      </Button>
    </div>
  </div>
</template>

<style>
.sigma-ui-toaster-progress {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  flex-direction: column;
  padding: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  backdrop-filter: blur(24px);
  background-color: hsl(var(--background) / 50%);
  box-shadow: var(--shadow-md);
  gap: 0.25rem;
  transition: backdrop-filter 160ms ease, background-color 160ms ease;
}

.sigma-ui-toaster-progress--delete .sigma-ui-toaster-progress__icon {
  color: hsl(var(--warning));
}

.sigma-ui-toaster-progress__header {
  display: flex;
  width: 100%;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 600;
  gap: 0.5rem;
}

.sigma-ui-toaster-progress__toolbar {
  display: flex;
  width: 100%;
  align-items: center;
  padding-top: 0.25rem;
}

.sigma-ui-toaster-progress__icon {
  flex-shrink: 0;
  color: hsl(var(--primary));
}

.sigma-ui-toaster-progress__title-prefix {
  overflow: hidden;
  min-width: 0;
  flex-shrink: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sigma-ui-toaster-progress__title-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--secondary) / 50%);
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 500;
  gap: 6px;
  line-height: 1.2;
}

.sigma-ui-toaster-progress__count-tag {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(var(--muted));
  font-size: 0.75rem;
  font-weight: 500;
}

.sigma-ui-toaster-progress__percentage {
  display: inline-flex;
  flex-shrink: 0;
  margin-left: auto;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  white-space: nowrap;
}

.sigma-ui-toaster-progress__subtitle {
  overflow: hidden;
  color: hsl(var(--foreground) / 75%);
  font-size: 0.875rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sigma-ui-toaster-progress__description {
  overflow: hidden;
  color: hsl(var(--foreground) / 45%);
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sigma-ui-toaster-progress__bar {
  width: 100%;
  height: 2px;
  border-radius: var(--rounded-full);
  background-color: hsl(var(--primary) / 10%);
  font-size: 0.875rem;
}

.sigma-ui-toaster-progress__bar-fill {
  height: 2px;
  border-radius: var(--rounded-full);
  background-color: hsl(var(--primary));
  transition: width 200ms ease-out;
}
</style>
