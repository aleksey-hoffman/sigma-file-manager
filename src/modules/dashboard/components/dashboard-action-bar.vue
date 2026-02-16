<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { EllipsisVerticalIcon, Trash2Icon } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

defineProps<{
  isEmpty?: boolean;
}>();

const emit = defineEmits<{
  'clear-all': [];
}>();

const { t } = useI18n();

function handleClearAll() {
  emit('clear-all');
}
</script>

<template>
  <div class="dashboard-action-bar">
    <div class="dashboard-action-bar__left">
      <slot name="left" />
    </div>
    <div class="dashboard-action-bar__right">
      <slot name="right" />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="dashboard-action-bar__menu-button"
          >
            <EllipsisVerticalIcon :size="16" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            :disabled="isEmpty"
            class="dashboard-action-bar__menu-item dashboard-action-bar__menu-item--destructive"
            @click="handleClearAll"
          >
            <Trash2Icon :size="14" />
            <span>{{ t('dashboard.actions.clearAll') }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>

<style>
.dashboard-action-bar {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dashboard-action-bar__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dashboard-action-bar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dashboard-action-bar__menu-button {
  width: 32px;
  height: 32px;
}

.dashboard-action-bar__menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dashboard-action-bar__menu-item--destructive {
  color: hsl(var(--destructive));
}

.dashboard-action-bar__menu-item--destructive:focus {
  background-color: hsl(var(--destructive) / 10%);
  color: hsl(var(--destructive));
}
</style>
