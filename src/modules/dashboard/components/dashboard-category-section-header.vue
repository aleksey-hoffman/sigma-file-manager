<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!-- FORK-MODIFICATION: 需求反馈 4（2026-10-15）——收藏分类的分区标题。
     「未分类」这一组不显示编辑按钮：它不是一个真实分类，没有 id 可改名/删除，
     给它挂一套无效操作比不显示更糟。 -->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { FolderIcon, PencilIcon, Trash2Icon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import type { FavoriteCategory } from '@/types/user-stats';

defineProps<{
  name: string;
  count: number;
  category: FavoriteCategory | null;
}>();

const emit = defineEmits<{
  'rename-category': [category: FavoriteCategory];
  'delete-category': [category: FavoriteCategory];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="dashboard-category-section-header">
    <FolderIcon :size="14" />
    <span class="dashboard-category-section-header__name">{{ name }}</span>
    <span class="dashboard-category-section-header__count">{{ count }}</span>

    <div
      v-if="category"
      class="dashboard-category-section-header__actions"
    >
      <Button
        variant="ghost"
        size="icon"
        class="dashboard-category-section-header__button"
        :title="t('dashboard.actions.renameCategory')"
        @click="emit('rename-category', category)"
      >
        <PencilIcon :size="14" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="dashboard-category-section-header__button"
        :title="t('dashboard.actions.deleteCategory')"
        @click="emit('delete-category', category)"
      >
        <Trash2Icon :size="14" />
      </Button>
    </div>
  </div>
</template>

<style>
.dashboard-category-section-header {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 4px 2px;
  color: hsl(var(--muted-foreground));
  gap: 6px;
}

.dashboard-category-section-header__name {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-weight: 500;
}

.dashboard-category-section-header__count {
  font-size: 0.75rem;
}

.dashboard-category-section-header__actions {
  display: flex;
  margin-left: auto;
  align-items: center;
  gap: 2px;
}

.dashboard-category-section-header__button {
  width: 26px;
  height: 26px;
}
</style>
