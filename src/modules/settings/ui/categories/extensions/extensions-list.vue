<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { SettingsItem } from '@/modules/settings';
import { PuzzleIcon } from 'lucide-vue-next';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import ExtensionSettings from './extension-settings.vue';

const { t } = useI18n();
const extensionsStore = useExtensionsStore();

const extensionsWithSettings = computed(() => {
  return extensionsStore.installedExtensions
    .filter(extension => extension.enabled)
    .filter((extension) => {
      const config = extension.manifest.contributes?.configuration;
      return config?.properties && Object.keys(config.properties).length > 0;
    });
});

const hasNoExtensions = computed(() => {
  return extensionsWithSettings.value.length === 0;
});
</script>

<template>
  <div class="extensions-settings">
    <SettingsItem
      v-if="hasNoExtensions"
      :title="t('extensions.settings.noExtensions')"
      :description="t('extensions.settings.noExtensionsDescription')"
      :icon="PuzzleIcon"
    />

    <ExtensionSettings
      v-for="extension in extensionsWithSettings"
      :key="extension.id"
      :extension="extension"
    />
  </div>
</template>

<style scoped>
.extensions-settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
