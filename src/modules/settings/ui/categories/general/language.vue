<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useI18n } from 'vue-i18n';
import { languages } from '@/localization/data';
import { computed } from 'vue';
import { LanguagesIcon } from '@lucide/vue';
import { BaseCombobox } from '@/components/base';

const { locale, t } = useI18n();
const userSettingsStore = useUserSettingsStore();

const selectedLanguage = computed({
  get: () => languages.find(lang => lang.locale === locale.value) ?? null,
  set: (language) => {
    if (!language) return;
    locale.value = language.locale;
    userSettingsStore.setLanguage(language);
  },
});
</script>

<template>
  <SettingsItem
    :title="t('language.language')"
    :icon="LanguagesIcon"
  >
    <div class="language-section">
      <BaseCombobox
        v-model="selectedLanguage"
        :options="languages"
        by="locale"
        :search-placeholder="t('search')"
        :empty-text="t('noData')"
        trigger-width="250px"
      />
    </div>
  </SettingsItem>
</template>

<style scoped>
.language-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
