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
import { CheckIcon, ChevronsUpDownIcon, SearchIcon, LanguagesIcon } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox';

const { locale, t } = useI18n();
const userSettingsStore = useUserSettingsStore();

const selectedLanguage = computed({
  get: () => languages.find(lang => lang.locale === locale.value),
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
      <Combobox
        v-model="selectedLanguage"
        by="locale"
      >
        <ComboboxAnchor as-child>
          <ComboboxTrigger as-child>
            <Button
              variant="outline"
              class="language-combobox__trigger"
            >
              {{ selectedLanguage?.name }}
              <ChevronsUpDownIcon class="language-combobox__chevron" />
            </Button>
          </ComboboxTrigger>
        </ComboboxAnchor>

        <ComboboxList>
          <div class="language-combobox__content">
            <span class="language-combobox__search-icon">
              <SearchIcon class="language-combobox__search-icon-icon" />
            </span>
            <ComboboxInput
              class="language-combobox__input"
              :placeholder="t('search')"
            />
          </div>

          <ComboboxEmpty>
            {{ t('noData') }}
          </ComboboxEmpty>

          <ComboboxGroup>
            <ComboboxItem
              v-for="language in languages"
              :key="language.locale"
              :value="language"
            >
              {{ language.name }}

              <ComboboxItemIndicator>
                <CheckIcon class="language-combobox__check" />
              </ComboboxItemIndicator>
            </ComboboxItem>
          </ComboboxGroup>
        </ComboboxList>
      </Combobox>
    </div>
  </SettingsItem>
</template>

<style scoped>
.language-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.language-combobox__trigger {
  display: flex;
  width: 250px;
  justify-content: flex-start;
  color: hsl(var(--muted-foreground));
  text-align: left;
}

.language-combobox__trigger-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  margin-right: 0.5rem;
  color: hsl(var(--muted-foreground));
}

.language-combobox__chevron {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  margin-left: auto;
  opacity: 0.5;
}

.language-combobox__content {
  position: relative;
  width: 250px;
  padding: 0;
}

.language-combobox__check {
  width: 1rem;
  height: 1rem;
  margin-left: auto;
}

.language-combobox__input {
  height: 2.25rem;
  padding-left: 2.25rem;
  border: none;
  border-radius: 0;
  background-color: transparent;
  box-shadow: 0 1px 0 0 hsl(var(--border));
  color: hsl(var(--foreground));
  outline: none;
}

.language-combobox__input:focus-visible {
  box-shadow: 0 1px 0 0 hsl(var(--border));
  outline: none;
}

.language-combobox__search-icon {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
}

.language-combobox__search-icon-icon {
  width: 1rem;
  height: 1rem;
  color: hsl(var(--muted-foreground));
}
</style>
