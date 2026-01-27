<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { FolderOpenIcon } from 'lucide-vue-next';
import { platform } from '@tauri-apps/plugin-os';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Button } from '@/components/ui/button';
import { SettingsItem } from '@/modules/settings';

const { t } = useI18n();

const isWindows = platform() === 'windows';

async function openAutoplaySettings() {
  await openUrl('ms-settings:autoplay');
}
</script>

<template>
  <SettingsItem
    v-if="isWindows"
    :title="t('settings.drives.autoplaySettings')"
    :description="t('settings.drives.autoplaySettingsDescription')"
    :icon="FolderOpenIcon"
  >
    <Button
      variant="secondary"
      @click="openAutoplaySettings"
    >
      {{ t('openWith.open') }}
    </Button>
  </SettingsItem>
</template>
