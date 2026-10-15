<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!-- FORK-MODIFICATION: 需求反馈 4（2026-10-15）——仪表盘「新建收藏」。

     类型（文件 / 目录）在提交时由后端 `path_is_regular_file` 判定，不让用户手动选。
     仪表盘原来靠「路径含 `.`」猜（`my.folder` 这类含点目录会被当成文件，点开就去找
     文件关联），FavoriteItem 加了 isFile 之后这个猜测被彻底换掉。
     校验用已注册的命令 `path_exists` + `path_is_regular_file`，没有新增 Rust 命令。 -->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import type { FavoriteCategory } from '@/types/user-stats';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  isAlreadyFavorite: (path: string) => boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'confirm': [path: string, isFile: boolean, categoryId: string | null];
}>();

const { t } = useI18n();

const pathDraft = ref('');
const categoryDraft = ref<string>(UNCATEGORIZED_VALUE);
const inputRef = ref<InstanceType<typeof Input> | null>(null);

type PathCheckState = 'idle' | 'checking' | 'missing' | 'ok' | 'duplicate' | 'error';
const pathCheckState = ref<PathCheckState>('idle');

const trimmedPath = computed(() => pathDraft.value.trim().replace(/^"|"$/g, ''));

const canSubmit = computed(() => {
  return Boolean(trimmedPath.value) && pathCheckState.value === 'ok';
});

let checkSequence = 0;

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }

    pathDraft.value = '';
    categoryDraft.value = UNCATEGORIZED_VALUE;
    pathCheckState.value = 'idle';
    checkSequence += 1;

    nextTick(() => {
      const host = inputRef.value?.$el;
      const element = host instanceof HTMLInputElement ? host : host?.querySelector('input');
      element?.focus();
    });
  },
  { immediate: true },
);

// Path validation is async, so a stale response must not overwrite a newer one:
// typing "a", "ab", "abc" fires three checks and they can land in any order.
watch(trimmedPath, (nextPath) => {
  const sequence = ++checkSequence;

  if (!nextPath) {
    pathCheckState.value = 'idle';
    return;
  }

  pathCheckState.value = 'checking';

  void (async () => {
    try {
      const exists = await invoke<boolean>('path_exists', { path: nextPath });

      if (sequence !== checkSequence) return;

      if (!exists) {
        pathCheckState.value = 'missing';
        return;
      }

      if (props.isAlreadyFavorite(nextPath)) {
        pathCheckState.value = 'duplicate';
        return;
      }

      pathCheckState.value = 'ok';
    }
    catch {
      if (sequence === checkSequence) {
        pathCheckState.value = 'error';
      }
    }
  })();
});

const stateMessage = computed(() => {
  if (pathCheckState.value === 'missing') {
    return t('dashboard.newFavoriteDialog.pathNotFound');
  }

  if (pathCheckState.value === 'duplicate') {
    return t('dashboard.newFavoriteDialog.pathAlreadyFavorite');
  }

  return '';
});

async function handleSubmit() {
  const path = trimmedPath.value;

  if (!path || !canSubmit.value) {
    return;
  }

  // Resolve the kind at submit time rather than during validation: the check above
  // only decides "is this usable", and the value could change between the two.
  const isFile = await invoke<boolean>('path_is_regular_file', { path }).catch(() => false);

  emit(
    'confirm',
    path,
    isFile,
    categoryDraft.value === UNCATEGORIZED_VALUE ? null : categoryDraft.value,
  );
  emit('update:open', false);
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="dashboard-new-favorite-dialog">
      <DialogHeader>
        <DialogTitle>{{ t('dashboard.newFavoriteDialog.title') }}</DialogTitle>
      </DialogHeader>

      <div class="dashboard-new-favorite-dialog__form">
        <label
          class="dashboard-new-favorite-dialog__label"
          for="dashboard-favorite-path"
        >{{ t('dashboard.newFavoriteDialog.pathLabel') }}</label>

        <Input
          id="dashboard-favorite-path"
          ref="inputRef"
          v-model="pathDraft"
          :placeholder="t('dashboard.newFavoriteDialog.pathPlaceholder')"
          :aria-invalid="Boolean(stateMessage)"
          @keydown.enter.prevent="handleSubmit"
        />

        <p
          v-if="stateMessage"
          class="dashboard-new-favorite-dialog__hint"
        >
          {{ stateMessage }}
        </p>

        <Select v-model="categoryDraft">
          <SelectTrigger class="dashboard-new-favorite-dialog__select">
            <SelectValue :placeholder="t('dashboard.tabs.favorites')" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
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
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ t('dashboard.newFavoriteDialog.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.dashboard-new-favorite-dialog {
  width: 520px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  overflow-x: hidden;
}

.dashboard-new-favorite-dialog > * {
  min-width: 0;
}

.dashboard-new-favorite-dialog__form {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.dashboard-new-favorite-dialog__label {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.dashboard-new-favorite-dialog__hint {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.dashboard-new-favorite-dialog__select {
  width: 100%;
}
</style>
