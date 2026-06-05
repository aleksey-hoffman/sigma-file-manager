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

export interface ArchiveOptions {
  password: string;
  encoding: string | undefined;
}

const props = defineProps<{
  open: boolean;
  needsPassword?: boolean;
  needsEncoding?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [options: ArchiveOptions];
  cancel: [];
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

const password = ref('');
const encoding = ref('__system_default__');

watch(() => props.open, (open) => {
  if (open) {
    password.value = '';
    encoding.value = '__system_default__';
  }
});

const encodingOptions = [
  { value: '__system_default__', label: t('fileBrowser.archive.optionsDialog.encodingSystemDefault') },
  { value: 'UTF-8', label: 'UTF-8' },
  { value: '---east-asian', label: '', disabled: true, group: 'eastAsian' },
  { value: 'shift_jis', label: 'Shift JIS (Japanese)' },
  { value: 'gb2312', label: 'GB2312 (Simplified Chinese)' },
  { value: 'big5', label: 'Big5 (Traditional Chinese)' },
  { value: 'ks_c_5601-1987', label: 'Korean (ks_c_5601-1987)' },
  { value: '---southeast-asian', label: '', disabled: true, group: 'southeastAsian' },
  { value: 'Windows-1258', label: 'Windows-1258 (Vietnamese)' },
  { value: 'Windows-874', label: 'Windows-874 (Thai)' },
  { value: '---middle-east', label: '', disabled: true, group: 'middleEast' },
  { value: 'Windows-1256', label: 'Windows-1256 (Arabic)' },
  { value: 'Windows-1255', label: 'Windows-1255 (Hebrew)' },
  { value: 'Windows-1254', label: 'Windows-1254 (Turkish)' },
  { value: '---european', label: '', disabled: true, group: 'european' },
  { value: 'Windows-1252', label: 'Windows-1252 (Western European)' },
  { value: 'Windows-1250', label: 'Windows-1250 (Central European)' },
  { value: 'Windows-1251', label: 'Windows-1251 (Cyrillic)' },
  { value: 'Windows-1253', label: 'Windows-1253 (Greek)' },
  { value: 'Windows-1257', label: 'Windows-1257 (Baltic)' },
  { value: 'macintosh', label: 'Macintosh' },
];

const isGroupItem = (value: string) => value.startsWith('---');

function onOpenChange(open: boolean) {
  if (!open) {
    emit('cancel');
  }
  emit('update:open', open);
}

function handleConfirm() {
  emit('confirm', {
    password: password.value,
    encoding: encoding.value === '__system_default__' ? undefined : encoding.value,
  });
}

function handleCancel() {
  emit('cancel');
  emit('update:open', false);
}
</script>

<template>
  <Dialog :open="props.open" @update:open="onOpenChange">
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
            <SelectContent>
              <template v-for="opt in encodingOptions" :key="opt.value">
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
        <Button variant="outline" @click="handleCancel">
          {{ t('cancel') }}
        </Button>
        <Button @click="handleConfirm">
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
  gap: 16px;
  padding: 8px 0;
}

.archive-options-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.archive-options-dialog__group-label {
  padding: 6px 8px 2px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: hsl(var(--muted-foreground));
  cursor: default;
  user-select: none;
}
</style>
