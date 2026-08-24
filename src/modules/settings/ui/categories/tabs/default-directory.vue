<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpenIcon } from '@lucide/vue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { DefaultDirectoryKind } from '@/types/user-settings';
import normalizePath from '@/utils/normalize-path';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const kindOptions: {
  name: string;
  value: DefaultDirectoryKind;
}[] = [
  {
    name: t('settings.tabs.defaultDirectory.userHome'),
    value: 'userHome',
  },
  {
    name: t('locations'),
    value: 'locations',
  },
  {
    name: t('settings.tabs.defaultDirectory.custom'),
    value: 'custom',
  },
];

const selectedKind = computed({
  get: () => {
    const value = userSettingsStore.userSettings.navigator?.defaultDirectory?.kind ?? 'userHome';
    return kindOptions.find(option => option.value === value) ?? kindOptions[0];
  },
  set: (option) => {
    if (option) {
      userSettingsStore.set('navigator.defaultDirectory.kind', option.value);
    }
  },
});

const customPathRaw = ref(userSettingsStore.userSettings.navigator?.defaultDirectory?.customPath ?? '');
const pathError = ref<string | null>(null);

const customPath = computed({
  get: () => normalizePath(customPathRaw.value),
  set: (value: string) => {
    customPathRaw.value = normalizePath(value);
  },
});

async function validateCustomPath(newPath: string) {
  if (!newPath) {
    pathError.value = null;
    return;
  }

  try {
    const pathExists = await invoke<boolean>('path_exists', { path: newPath });
    pathError.value = pathExists
      ? null
      : t('dialogs.userDirectoryEditorDialog.pathDoesNotExist');
  }
  catch {
    pathError.value = t('dialogs.userDirectoryEditorDialog.pathDoesNotExist');
  }
}

watch(customPath, async (newPath) => {
  await userSettingsStore.set('navigator.defaultDirectory.customPath', newPath);
  await validateCustomPath(newPath);
});

watch(() => selectedKind.value?.value, (kind) => {
  if (kind === 'custom') {
    validateCustomPath(customPath.value);
  }
}, { immediate: true });

async function handleBrowse() {
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: customPath.value || undefined,
  });

  if (selected) {
    customPath.value = normalizePath(selected);
  }
}
</script>

<template>
  <SettingsItem
    :title="t('settings.tabs.defaultDirectory.title')"
    :description="t('settings.tabs.defaultDirectory.description')"
    :icon="FolderOpenIcon"
  >
    <Select
      v-model="selectedKind"
      by="value"
    >
      <SelectTrigger class="default-directory-select-trigger">
        <SelectValue>
          {{ selectedKind?.name }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in kindOptions"
          :key="option.value"
          :value="option"
        >
          <SelectItemText>
            {{ option.name }}
          </SelectItemText>
        </SelectItem>
      </SelectContent>
    </Select>

    <template
      v-if="selectedKind?.value === 'custom'"
      #nested
    >
      <div class="default-directory-path">
        <label
          for="default-directory-custom-path"
          class="default-directory-path__label"
        >
          {{ t('settings.tabs.defaultDirectory.customPath') }}
        </label>
        <div class="default-directory-path__row">
          <Input
            id="default-directory-custom-path"
            v-model="customPath"
            :class="{ 'default-directory-path__input--error': pathError }"
          />
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="secondary"
                size="icon"
                @click="handleBrowse"
              >
                <FolderOpenIcon :size="16" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{ t('browse') }}
            </TooltipContent>
          </Tooltip>
        </div>
        <div
          v-if="pathError"
          class="default-directory-path__error"
        >
          {{ pathError }}
        </div>
      </div>
    </template>
  </SettingsItem>
</template>

<style scoped>
.default-directory-select-trigger {
  min-width: 180px;
}

.default-directory-path {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 0.5rem;
}

.default-directory-path__label {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.default-directory-path__row {
  display: flex;
  gap: 0.5rem;
}

.default-directory-path__row :deep(.sigma-ui-input) {
  flex: 1;
}

.default-directory-path__input--error {
  border-color: hsl(var(--destructive));
}

.default-directory-path__error {
  color: hsl(var(--destructive));
  font-size: 0.75rem;
}
</style>
