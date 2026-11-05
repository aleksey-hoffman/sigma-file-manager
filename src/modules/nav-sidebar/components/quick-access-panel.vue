<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import QuickAccessList from './quick-access-list.vue';

const { t } = useI18n();
const emit = defineEmits<{
  'drag-start': [];
  'drag-end': [];
}>();
</script>

<template>
  <div class="quick-access-panel">
    <div class="quick-access-panel__header">
      <span class="quick-access-panel__title">{{ t('quickAccess.title') }}</span>
    </div>

    <QuickAccessList
      @drag-start="emit('drag-start')"
      @drag-end="emit('drag-end')"
    />
  </div>
</template>

<style scoped>
.quick-access-panel {
  --tooltip-height: 40px;
  --header-height: 32px;
  --max-height: calc(100vh - 12px - var(--tooltip-height));
  --quick-access-list-max-height: calc(var(--max-height) - var(--header-height));

  display: flex;
  width: var(--quick-access-panel-width);
  max-height: var(--max-height);
  flex-direction: column;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}

.quick-access-panel__header {
  height: var(--header-height);
  flex-shrink: 0;
  padding: 6px 16px;
}

.quick-access-panel__title {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-weight: 600;
}
</style>
