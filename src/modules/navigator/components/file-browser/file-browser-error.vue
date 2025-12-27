<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { AlertCircleIcon } from 'lucide-vue-next';

defineProps<{
  error: string;
}>();

defineEmits<{
  goHome: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="file-browser-error">
    <AlertCircleIcon :size="32" />
    <span>{{ error }}</span>
    <Button
      variant="secondary"
      size="sm"
      @click="$emit('goHome')"
    >
      {{ t('fileBrowser.goHome') }}
    </Button>
  </div>
</template>

<style scoped>
.file-browser-error {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: hsl(var(--destructive));
  gap: 16px;
}
</style>
