<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { FolderOpenIcon } from '@lucide/vue';
import { Switch } from '@/components/ui/switch';
import { SettingsItem } from '@/modules/settings';
import { useI18n } from 'vue-i18n';
import { usePlatformStore } from '@/stores/runtime/platform';
import {
  isDefaultFileManager,
  setDefaultFileManager,
} from '@/utils/default-file-manager';

const { t } = useI18n();
const platformStore = usePlatformStore();

const isEnabled = ref(false);
const isLoading = ref(true);
const isApplying = ref(false);

async function refreshDefaultFileManagerState() {
  isLoading.value = true;

  try {
    isEnabled.value = await isDefaultFileManager();
  }
  catch (error) {
    console.error('Failed to read default file manager state:', error);
    isEnabled.value = false;
  }
  finally {
    isLoading.value = false;
  }
}

async function onDefaultFileManagerChange(enabled: boolean) {
  isApplying.value = true;

  try {
    isEnabled.value = await setDefaultFileManager(enabled);
  }
  catch (error) {
    console.error('Failed to update default file manager state:', error);
    await refreshDefaultFileManagerState();
  }
  finally {
    isApplying.value = false;
  }
}

onMounted(async () => {
  if (!platformStore.isWindows) {
    isLoading.value = false;
    return;
  }

  await refreshDefaultFileManagerState();
});
</script>

<template>
  <SettingsItem
    v-if="platformStore.isWindows"
    :title="t('settings.experimental.defaultFileManager.title')"
    :description="t('settings.experimental.defaultFileManager.description')"
    :icon="FolderOpenIcon"
  >
    <Switch
      id="default-file-manager"
      :disabled="isLoading || isApplying"
      :model-value="isEnabled"
      @update:model-value="onDefaultFileManagerChange"
    />
  </SettingsItem>
</template>
