<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!-- FORK-MODIFICATION: 需求反馈 4（2026-10-15）——仪表盘卡片上的编辑入口。

     用户要的是「在签页可以对已经添加的收藏、标记进行排序、修改分类等编辑」。
     排序做成**上移/下移按钮而不是拖拽**：仪表盘收藏是 grid，而
     `components/ui/sortable/sortable-geometry.ts` 只比 Y 轴行中点
     （captureRowHeights 从 listTop 起逐项累加高度），N 列并排时中点被累加成
     「N 倍高」的假坐标，横向跨列完全无感知。改全局组件的影响面远大于这次的收益，
     上移/下移同样满足「排序」的诉求，且在 grid 上不会算错索引。 -->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ArrowDownIcon, ArrowUpIcon, EllipsisVerticalIcon, XIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FavoriteCategory } from '@/types/user-stats';

const UNCATEGORIZED_VALUE = '__afm_uncategorized__';

withDefaults(defineProps<{
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** 只有收藏卡片需要「移到分类」。 */
  showCategoryPicker?: boolean;
  categories?: FavoriteCategory[];
  currentCategoryId?: string | null;
  removeLabel: string;
}>(), {
  showCategoryPicker: false,
  categories: () => [],
  currentCategoryId: null,
});

const emit = defineEmits<{
  'move-up': [];
  'move-down': [];
  'move-to-category': [categoryId: string | null];
  'remove': [];
}>();

const { t } = useI18n();

// reka-ui types the select value as `AcceptableValue` (string | number | ...),
// but every SelectItem here carries a string value, so anything that is not the
// uncategorized sentinel is a category id.
function normalizeCategoryValue(value: unknown): string | null {
  return typeof value === 'string' && value !== UNCATEGORIZED_VALUE ? value : null;
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="dashboard-entry-actions__trigger"
        @click.stop
      >
        <EllipsisVerticalIcon :size="14" />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      align="end"
      @click.stop
    >
      <DropdownMenuItem
        :disabled="!canMoveUp"
        @click="emit('move-up')"
      >
        <ArrowUpIcon :size="14" />
        <span>{{ t('dashboard.actions.moveUp') }}</span>
      </DropdownMenuItem>

      <DropdownMenuItem
        :disabled="!canMoveDown"
        @click="emit('move-down')"
      >
        <ArrowDownIcon :size="14" />
        <span>{{ t('dashboard.actions.moveDown') }}</span>
      </DropdownMenuItem>

      <template v-if="showCategoryPicker">
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{{ t('dashboard.actions.moveToCategory') }}</DropdownMenuLabel>

        <div
          class="dashboard-entry-actions__category"
          @click.stop
        >
          <Select
            :model-value="currentCategoryId ?? UNCATEGORIZED_VALUE"
            @update:model-value="value => emit('move-to-category', normalizeCategoryValue(value))"
          >
            <SelectTrigger class="dashboard-entry-actions__category-trigger">
              <SelectValue :placeholder="t('dashboard.actions.uncategorized')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="UNCATEGORIZED_VALUE">
                {{ t('dashboard.actions.uncategorized') }}
              </SelectItem>
              <SelectItem
                v-for="category in categories"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </template>

      <DropdownMenuSeparator />

      <DropdownMenuItem
        class="dashboard-entry-actions__remove"
        @click="emit('remove')"
      >
        <XIcon :size="14" />
        <span>{{ removeLabel }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<style>
.dashboard-entry-actions__trigger {
  width: 26px;
  height: 26px;
  font-size: 0.875rem;
  line-height: 1;
}

.dashboard-entry-actions__category {
  padding: 4px 8px;
}

.dashboard-entry-actions__category-trigger {
  width: 100%;
}

.dashboard-entry-actions__remove {
  color: hsl(var(--destructive));
}
</style>
