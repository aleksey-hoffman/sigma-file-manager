<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SearchIcon, XIcon, RefreshCwIcon } from 'lucide-vue-next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useI18n } from 'vue-i18n';

defineProps<{
  modelValue: string;
  isRefreshing?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'refresh': [];
}>();

const { t } = useI18n();

function clearSearch() {
  emit('update:modelValue', '');
}
</script>

<template>
  <div class="extension-search">
    <div class="extension-search__input-wrapper">
      <SearchIcon
        :size="18"
        class="extension-search__icon"
      />
      <Input
        :model-value="modelValue"
        type="text"
        :placeholder="t('extensions.searchPlaceholder')"
        class="extension-search__input"
        @update:model-value="emit('update:modelValue', String($event ?? ''))"
      />
      <Button
        v-if="modelValue"
        variant="ghost"
        size="icon"
        class="extension-search__clear"
        @click="clearSearch"
      >
        <XIcon :size="16" />
      </Button>
    </div>

    <Button
      variant="outline"
      :disabled="isRefreshing"
      @click="emit('refresh')"
    >
      <RefreshCwIcon
        :size="16"
        :class="{ 'extension-search__spinner': isRefreshing }"
      />
      {{ t('extensions.refresh') }}
    </Button>
  </div>
</template>

<style>
.extension-search {
  display: flex;
  align-items: center;
  gap: 12px;
}

.extension-search__input-wrapper {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
}

.extension-search__icon {
  position: absolute;
  left: 12px;
  color: hsl(var(--muted-foreground));
  pointer-events: none;
}

.extension-search__input {
  padding-right: 40px;
  padding-left: 40px;
}

.extension-search__clear {
  position: absolute;
  right: 4px;
  width: 32px;
  height: 32px;
}

.extension-search__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
