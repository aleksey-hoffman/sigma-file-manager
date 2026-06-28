<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { RefreshCwIcon, XIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import ExtensionBadge from './extension-badge.vue';

defineProps<{
  extensionId: string;
  displayName: string;
  isCancelling: boolean;
  isCancelDisabled: boolean;
}>();

const emit = defineEmits<{
  cancel: [extensionId: string];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="extension-install-progress-item">
    <div class="extension-install-progress-item__icon">
      <RefreshCwIcon
        :size="24"
        class="extension-install-progress-item__spinner"
      />
    </div>

    <div class="extension-install-progress-item__info">
      <div class="extension-install-progress-item__header">
        <span class="extension-install-progress-item__name">{{ displayName }}</span>
        <ExtensionBadge type="local" />
      </div>
      <div class="extension-install-progress-item__meta">
        <span>{{ isCancelling ? t('extensions.cancellingInstall') : t('extensions.installing') }}</span>
      </div>
    </div>

    <div class="extension-install-progress-item__actions">
      <Button
        variant="outline"
        size="icon"
        :title="t('extensions.cancelInstall')"
        :disabled="isCancelDisabled"
        @click.stop="emit('cancel', extensionId)"
      >
        <XIcon :size="16" />
      </Button>
    </div>
  </div>
</template>

<style>
.extension-install-progress-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  gap: 16px;
}

.extension-install-progress-item__icon {
  display: flex;
  width: 48px;
  min-width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--primary));
}

.extension-install-progress-item__info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.extension-install-progress-item__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.extension-install-progress-item__name {
  color: hsl(var(--foreground));
  font-weight: 600;
}

.extension-install-progress-item__meta {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.extension-install-progress-item__actions {
  display: flex;
  align-items: center;
}

.extension-install-progress-item__spinner {
  animation: extension-install-progress-item-spin 1s linear infinite;
}

@keyframes extension-install-progress-item-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
