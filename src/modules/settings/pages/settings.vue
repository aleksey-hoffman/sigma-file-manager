<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { SettingsHeader, SettingsContent, SettingsSearch, SettingsActions } from '@/modules/settings';
import { PageDefaultLayout } from '@/layouts';
import { useSettingsStore } from '@/stores/runtime/settings';

const { t } = useI18n();
const settingsStore = useSettingsStore();

onMounted(() => {
  settingsStore.init();
});
</script>

<template>
  <PageDefaultLayout
    class="settings-page"
    :title="t('pages.settings')"
  >
    <SettingsActions />
    <SettingsSearch />
    <SettingsHeader />
    <SettingsContent />
  </PageDefaultLayout>
</template>

<style scoped>
.settings-page {
  color: hsl(var(--foreground));
}
</style>
