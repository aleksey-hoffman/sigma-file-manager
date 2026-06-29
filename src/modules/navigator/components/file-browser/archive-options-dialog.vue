<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ARCHIVE_ENCODING_SYSTEM_DEFAULT_VALUE,
  createArchiveEncodingSelectOptions,
  getSelectableArchiveEncodingValues,
} from '@/constants/archive-encoding-options';

export interface ArchiveOptions {
  password: string;
  encoding: string | undefined;
}

const props = defineProps<{
  open: boolean;
  needsPassword?: boolean;
  needsEncoding?: boolean;
  detectedEncoding?: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'confirm': [options: ArchiveOptions];
}>();

const { t } = useI18n();

const dialogTitle = computed(() => {
  if (props.needsPassword && props.needsEncoding) return t('fileBrowser.archive.optionsDialog.title');
  if (props.needsPassword) return t('fileBrowser.archive.optionsDialog.passwordTitle');
  return t('fileBrowser.archive.optionsDialog.encodingTitle');
});

const dialogDescription = computed(() => {
  if (props.needsPassword && props.needsEncoding) return t('fileBrowser.archive.optionsDialog.description');
  if (props.needsPassword) return t('fileBrowser.archive.optionsDialog.passwordDescription');
  return t('fileBrowser.archive.optionsDialog.encodingDescription');
});

const canConfirm = computed(() => {
  if (props.needsPassword && !password.value.trim()) {
    return false;
  }

  return true;
});

const password = ref('');
const encoding = ref(ARCHIVE_ENCODING_SYSTEM_DEFAULT_VALUE);

const encodingOptions = computed(() => createArchiveEncodingSelectOptions(t));

const selectableEncodingValues = computed(() => getSelectableArchiveEncodingValues(encodingOptions.value));

function resolveInitialEncoding(detectedEncoding?: string): string {
  if (detectedEncoding && selectableEncodingValues.value.has(detectedEncoding)) {
    return detectedEncoding;
  }

  return ARCHIVE_ENCODING_SYSTEM_DEFAULT_VALUE;
}

watch(() => props.open, (open) => {
  if (open) {
    password.value = '';
    encoding.value = resolveInitialEncoding(props.detectedEncoding);
  }
});

function onOpenChange(open: boolean) {
  emit('update:open', open);
}

function handleConfirm() {
  if (!canConfirm.value) {
    return;
  }

  emit('confirm', {
    password: password.value,
    encoding: encoding.value === ARCHIVE_ENCODING_SYSTEM_DEFAULT_VALUE ? undefined : encoding.value,
  });
}

function handleCancel() {
  emit('update:open', false);
}
</script>

<template>
  <Dialog
    :open="props.open"
    @update:open="onOpenChange"
  >
    <DialogContent class="archive-options-dialog">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
        <DialogDescription v-if="dialogDescription">
          {{ dialogDescription }}
        </DialogDescription>
      </DialogHeader>

      <div class="archive-options-dialog__fields">
        <div
          v-if="props.needsPassword"
          class="archive-options-dialog__field"
        >
          <Label for="archive-password">
            {{ t('fileBrowser.archive.optionsDialog.passwordLabel') }}
          </Label>
          <Input
            id="archive-password"
            v-model="password"
            type="password"
            :placeholder="t('fileBrowser.archive.optionsDialog.passwordPlaceholder')"
          />
        </div>

        <div
          v-if="props.needsEncoding"
          class="archive-options-dialog__field"
        >
          <Label for="archive-encoding">
            {{ t('fileBrowser.archive.optionsDialog.encodingLabel') }}
          </Label>
          <Select v-model="encoding">
            <SelectTrigger id="archive-encoding">
              <SelectValue :placeholder="t('fileBrowser.archive.optionsDialog.encodingSystemDefault')" />
            </SelectTrigger>
            <SelectContent
              class="archive-options-dialog__encoding-select-content"
              :collision-padding="10"
            >
              <template
                v-for="opt in encodingOptions"
                :key="opt.value"
              >
                <div
                  v-if="opt.group"
                  class="archive-options-dialog__group-label"
                >
                  {{ t(`fileBrowser.archive.optionsDialog.encodingGroup.${opt.group}`) }}
                </div>
                <SelectItem
                  v-else
                  :value="opt.value"
                  :disabled="opt.disabled"
                >
                  <SelectItemText>{{ opt.label }}</SelectItemText>
                </SelectItem>
              </template>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="handleCancel"
        >
          {{ t('cancel') }}
        </Button>
        <Button
          :disabled="!canConfirm"
          @click="handleConfirm"
        >
          {{ t('fileBrowser.archive.optionsDialog.extract') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style>
.archive-options-dialog {
  width: 420px;
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  overflow-x: hidden;
}

.archive-options-dialog > * {
  min-width: 0;
}

.archive-options-dialog__fields {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  gap: 16px;
}

.archive-options-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.archive-options-dialog__group-label {
  padding: 6px 8px 2px;
  color: hsl(var(--muted-foreground));
  cursor: default;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  user-select: none;
}

.archive-options-dialog__encoding-select-content.sigma-ui-select-content {
  max-height: min(400px, var(--reka-select-content-available-height, 400px));
}
</style>
