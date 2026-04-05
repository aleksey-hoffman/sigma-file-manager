<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { FolderOpenIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

defineProps<{
  error: string;
}>();

defineEmits<{
  goHome: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="file-browser__empty-state-container"
    data-e2e-root="file-browser-access-error"
  >
    <EmptyState
      :icon="FolderOpenIcon"
      :title="t('fileBrowser.directoryAccessErrorTitle')"
      :description="error"
      :bordered="false"
    >
      <template #footer>
        <Button
          variant="secondary"
          size="sm"
          @click="$emit('goHome')"
        >
          {{ t('fileBrowser.goHome') }}
        </Button>
      </template>
    </EmptyState>
  </div>
</template>
