<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ExtensionIcon from '@/modules/extensions/components/extension-icon.vue';

type Props = {
  title: string;
  subtitle?: string;
  itemCount?: number;
  extensionId?: string;
  extensionIconPath?: string;
};

const props = defineProps<Props>();
const { t } = useI18n();

const formattedTitle = computed(() => {
  const titleText = props.title ?? '';
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
</script>

<template>
  <div class="sigma-ui-toast-header">
    <div class="sigma-ui-toast-header__row">
      <slot name="leading" />
      <span class="sigma-ui-toast-header__title-prefix">
        {{ formattedTitle.prefix }}
      </span>
      <span
        v-if="formattedTitle.hasBadge"
        class="sigma-ui-toast-header__title-badge"
      >
        <ExtensionIcon
          v-if="props.extensionId"
          :extension-id="props.extensionId"
          :icon-path="props.extensionIconPath"
          :size="12"
        />
        {{ formattedTitle.badge }}
      </span>
      <span
        v-if="props.itemCount"
        class="sigma-ui-toast-header__count-tag"
      >
        {{ t('item', props.itemCount) }}
      </span>
      <slot name="trailing" />
    </div>
    <div
      v-if="props.subtitle"
      class="sigma-ui-toast-header__subtitle"
    >
      {{ props.subtitle }}
    </div>
  </div>
</template>

<style>
.sigma-ui-toast-header {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
}

.sigma-ui-toast-header__row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
}

.sigma-ui-toast-header__title-prefix {
  overflow: hidden;
  min-width: 0;
  flex-shrink: 1;
  font-size: 0.875rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sigma-ui-toast-header__title-badge {
  display: inline-flex;
  overflow: hidden;
  min-width: 0;
  max-width: 50%;
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
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sigma-ui-toast-header__title-badge :deep(svg),
.sigma-ui-toast-header__title-badge :deep(img) {
  flex-shrink: 0;
}

.sigma-ui-toast-header__count-tag {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(var(--muted));
  font-size: 0.75rem;
  font-weight: 500;
}

.sigma-ui-toast-header__subtitle {
  width: 100%;
  min-width: 0;
  color: hsl(var(--foreground) / 75%);
  font-size: 0.875rem;
  font-weight: 500;
  overflow-wrap: anywhere;
  white-space: normal;
}
</style>
