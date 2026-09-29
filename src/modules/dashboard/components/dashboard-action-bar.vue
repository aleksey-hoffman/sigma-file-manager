<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';
import { EllipsisVerticalIcon, Trash2Icon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import DashboardConfirmDialog from '@/modules/dashboard/components/dashboard-confirm-dialog.vue';
import { getStaggerSlideUpBinding } from '@/utils/stagger-animation';

defineProps<{
  title: string;
  isEmpty?: boolean;
}>();

const emit = defineEmits<{
  'clear-all': [];
}>();

const { t } = useI18n();
const slots = useSlots();
const isConfirmOpen = ref(false);
const hasCustomMenu = computed(() => !!slots.menu);

function openClearAllConfirm() {
  isConfirmOpen.value = true;
}

function handleClearAll() {
  emit('clear-all');
}
</script>

<template>
  <div
    class="dashboard-action-bar"
    v-bind="getStaggerSlideUpBinding(0)"
  >
    <div class="dashboard-action-bar__left">
      <h2 class="dashboard-action-bar__title">
        {{ title }}
      </h2>
      <slot name="left" />
    </div>
    <div
      v-if="slots.filters"
      class="dashboard-action-bar__filters"
    >
      <slot name="filters" />
    </div>
    <div class="dashboard-action-bar__right">
      <slot name="right" />
      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="dashboard-action-bar__menu-button"
              >
                <EllipsisVerticalIcon :size="16" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {{ t('options') }}
          </TooltipContent>
          <DropdownMenuContent align="end">
            <slot
              v-if="hasCustomMenu"
              name="menu"
            />
            <DropdownMenuItem
              v-else
              :disabled="isEmpty"
              class="dashboard-action-bar__menu-item dashboard-action-bar__menu-item--destructive"
              @click="openClearAllConfirm"
            >
              <Trash2Icon :size="14" />
              <span>{{ t('dashboard.actions.clearAll') }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>
    </div>
    <DashboardConfirmDialog
      v-model:open="isConfirmOpen"
      :title="t('dashboard.actions.clearAllConfirmTitle')"
      :description="t('dashboard.actions.clearAllConfirmDescription')"
      @confirm="handleClearAll"
    />
  </div>
</template>

<style>
.dashboard-action-bar {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  gap: 12px;
}

.dashboard-action-bar__left {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 12px;
}

.dashboard-action-bar__title {
  overflow: hidden;
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-action-bar__filters {
  display: flex;
  min-width: 0;
  align-items: center;
}

.dashboard-action-bar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (width <= 768px) {
  .dashboard-action-bar {
    flex-wrap: wrap;
  }

  .dashboard-action-bar__filters {
    flex-basis: 100%;
    order: 1;
  }
}

.dashboard-action-bar__menu-button {
  width: 2.25rem;
  height: 2.25rem;
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
