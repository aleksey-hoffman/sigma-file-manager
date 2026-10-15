<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!-- FORK-MODIFICATION: 需求反馈 4（2026-10-15）——「新建分类」与「新建标记」共用的命名对话框。

     两者要的输入完全一样（一个名称，标记额外要一个颜色），各写一个对话框会得到
     两份会漂移的校验与焦点处理，所以合成一个组件由 props 区分。 -->

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const props = withDefaults(defineProps<{
  open: boolean;
  title: string;
  initialName?: string;
  /** 传入则显示取色器（新建标记用）。 */
  initialColor?: string;
  /** 外部判定重名时把冲突的名字传进来，组件据此显示错误并禁止提交。 */
  duplicateOf?: string | null;
}>(), {
  initialName: '',
  initialColor: '',
  duplicateOf: null,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  'confirm': [name: string, color: string];
}>();

const { t } = useI18n();

const nameDraft = ref('');
const colorDraft = ref('');
const inputRef = ref<InstanceType<typeof Input> | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }

    nameDraft.value = props.initialName;
    colorDraft.value = props.initialColor;

    nextTick(() => {
      const host = inputRef.value?.$el;
      const element = host instanceof HTMLInputElement ? host : host?.querySelector('input');
      element?.focus();
      element?.select();
    });
  },
  { immediate: true },
);

function handleSubmit() {
  const trimmed = nameDraft.value.trim();

  if (!trimmed || props.duplicateOf) {
    return;
  }

  emit('confirm', trimmed, colorDraft.value);
  emit('update:open', false);
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="dashboard-name-dialog">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>

      <div class="dashboard-name-dialog__form">
        <label
          class="dashboard-name-dialog__label"
          for="dashboard-name-input"
        >{{ t('dashboard.nameDialog.nameLabel') }}</label>

        <Input
          id="dashboard-name-input"
          ref="inputRef"
          v-model="nameDraft"
          :placeholder="t('dashboard.nameDialog.namePlaceholder')"
          :aria-invalid="Boolean(duplicateOf)"
          @keydown.enter.prevent="handleSubmit"
        />

        <p
          v-if="duplicateOf"
          class="dashboard-name-dialog__error"
        >
          {{ t('dashboard.nameDialog.duplicateName', { name: duplicateOf }) }}
        </p>

        <div
          v-if="initialColor"
          class="dashboard-name-dialog__color"
        >
          <input
            v-model="colorDraft"
            type="color"
            class="dashboard-name-dialog__color-input"
          >
        </div>
      </div>

      <DialogFooter>
        <Button
          :disabled="!nameDraft.trim() || Boolean(duplicateOf)"
          @click="handleSubmit"
        >
          {{ t('dashboard.nameDialog.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.dashboard-name-dialog {
  width: 400px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  overflow-x: hidden;
}

.dashboard-name-dialog > * {
  min-width: 0;
}

.dashboard-name-dialog__form {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.dashboard-name-dialog__label {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.dashboard-name-dialog__error {
  margin: 0;
  color: hsl(var(--destructive));
  font-size: 0.75rem;
}

.dashboard-name-dialog__color {
  display: flex;
  align-items: center;
}

.dashboard-name-dialog__color-input {
  width: 44px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}
</style>
