<!-- SPDX-License-Identifier: GPL-3.0-or later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!-- FORK-MODIFICATION: 用户反馈（2026-10-15）——右键「添加到收藏」时多一步选分类。

     与 dashboard-new-favorite-dialog 的区别：那边是「手工输路径新建收藏」，
     这边路径由右键操作已经确定了，用户只缺「放进哪个分类」。
     所以这里**不出现路径输入框**，只让用户选分类，或者当场新建一个分类。

     新建分类走 store 的 createFavoriteCategory，重名会被 store 拒掉
     （大小写不敏感），因此这里不再重复校验，但要把失败原样透出去 ——
     静默失败会让人以为分类建好了，下一次添加又落到未分类。 -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FavoriteCategory } from '@/types/user-stats';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from '@/components/ui/select';

const UNCATEGORIZED_VALUE = '__afm_uncategorized__';

const props = defineProps<{
  open: boolean;
  categories: FavoriteCategory[];
  entryNames: string[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  /** 确认。newCategoryName 非空时优先于 categoryId。 */
  'confirm': [categoryId: string | null, newCategoryName: string | null];
}>();

const { t } = useI18n();

const categoryDraft = ref<string>(UNCATEGORIZED_VALUE);
const newCategoryDraft = ref('');

// 每次打开都要复位：上一次留下的分类会把这次的条目悄悄归到错的地方。
watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }

    categoryDraft.value = UNCATEGORIZED_VALUE;
    newCategoryDraft.value = '';
  },
  { immediate: true },
);

const trimmedNewCategory = computed(() => newCategoryDraft.value.trim());

const targetLabel = computed(() => {
  const names = props.entryNames.filter(Boolean);

  if (names.length === 0) {
    return '';
  }

  if (names.length === 1) {
    return names[0]!;
  }

  // 多选时只报数量：列全名既截断又没信息量。
  return t('fileBrowser.favoriteCategoryDialog.multipleEntries', names.length);
});

function handleConfirm() {
  emit(
    'confirm',
    categoryDraft.value === UNCATEGORIZED_VALUE ? null : categoryDraft.value,
    trimmedNewCategory.value || null,
  );
  emit('update:open', false);
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="file-browser-favorite-category-dialog">
      <DialogHeader>
        <DialogTitle>{{ t('fileBrowser.favoriteCategoryDialog.title') }}</DialogTitle>
        <DialogDescription v-if="targetLabel">
          {{ targetLabel }}
        </DialogDescription>
      </DialogHeader>

      <div class="file-browser-favorite-category-dialog__form">
        <label
          class="file-browser-favorite-category-dialog__label"
          for="afm-favorite-category"
        >{{ t('fileBrowser.favoriteCategoryDialog.categoryLabel') }}</label>

        <Select v-model="categoryDraft">
          <SelectTrigger
            id="afm-favorite-category"
            class="file-browser-favorite-category-dialog__select"
          >
            <SelectValue :placeholder="t('fileBrowser.favoriteCategoryDialog.categoryLabel')" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem :value="UNCATEGORIZED_VALUE">
                {{ t('fileBrowser.favoriteCategoryDialog.uncategorized') }}
              </SelectItem>
              <SelectItem
                v-for="category in categories"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <label
          class="file-browser-favorite-category-dialog__label"
          for="afm-favorite-new-category"
        >{{ t('fileBrowser.favoriteCategoryDialog.newCategoryLabel') }}</label>

        <Input
          id="afm-favorite-new-category"
          v-model="newCategoryDraft"
          :placeholder="t('fileBrowser.favoriteCategoryDialog.newCategoryPlaceholder')"
          @keydown.enter.prevent="handleConfirm"
        />
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="emit('update:open', false)"
        >
          {{ t('cancel') }}
        </Button>
        <Button @click="handleConfirm">
          {{ t('fileBrowser.favoriteCategoryDialog.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.file-browser-favorite-category-dialog {
  width: 480px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  overflow-x: hidden;
}

.file-browser-favorite-category-dialog > * {
  min-width: 0;
}

.file-browser-favorite-category-dialog__form {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.file-browser-favorite-category-dialog__label {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.file-browser-favorite-category-dialog__select {
  width: 100%;
}
</style>
