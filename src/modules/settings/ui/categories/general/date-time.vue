<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { CalendarClockIcon } from '@lucide/vue';
import { SettingsItem } from '@/modules/settings';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BaseCombobox } from '@/components/base';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { languages } from '@/localization/data';
import { formatDateTimeDisplay } from '@/utils/date-time';
import type { LocalizationLanguage } from '@/types/user-settings';

const PREVIEW_SAMPLE_INSTANT = new Date(2026, 2, 26, 17, 25, 0, 0);

const userSettingsStore = useUserSettingsStore();
const { t, locale } = useI18n();

const previewText = computed(() => {
  return formatDateTimeDisplay(
    PREVIEW_SAMPLE_INSTANT,
    userSettingsStore.userSettings.dateTime,
    locale.value,
  );
});

const autoDetectRegionalFormat = computed({
  get: () => userSettingsStore.userSettings.dateTime.autoDetectRegionalFormat,
  set: (value: boolean) => {
    userSettingsStore.set('dateTime.autoDetectRegionalFormat', value);
  },
});

const hour12 = computed({
  get: () => userSettingsStore.userSettings.dateTime.hour12,
  set: (value: boolean) => {
    userSettingsStore.set('dateTime.hour12', value);
  },
});

async function onShowSecondsChange(enabled: boolean) {
  if (!enabled) {
    await userSettingsStore.set('dateTime.properties.showMilliseconds', false);
  }

  await userSettingsStore.set('dateTime.properties.showSeconds', enabled);
}

async function onShowMillisecondsChange(enabled: boolean) {
  if (enabled) {
    await userSettingsStore.set('dateTime.properties.showSeconds', true);
  }

  await userSettingsStore.set('dateTime.properties.showMilliseconds', enabled);
}

const selectedRegionalLanguage = computed({
  get: () => languages.find(lang => lang.locale === userSettingsStore.userSettings.dateTime.regionalFormat.code) ?? null,
  set: (language: LocalizationLanguage | null) => {
    if (!language) return;
    userSettingsStore.userSettings.dateTime.regionalFormat = {
      code: language.locale,
      name: language.name,
    };
    userSettingsStore.set('dateTime.regionalFormat', userSettingsStore.userSettings.dateTime.regionalFormat);
  },
});

const monthFormatTab = computed({
  get(): 'numeric' | 'short' | 'long' {
    return userSettingsStore.userSettings.dateTime.month;
  },
  set(value: string) {
    if (value === 'numeric' || value === 'short' || value === 'long') {
      void userSettingsStore.set('dateTime.month', value);
    }
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.dateTime.dateTime')"
    :icon="CalendarClockIcon"
  >
    <div class="date-time-settings__header-preview">
      <div class="date-time-settings__preview-value">
        {{ previewText }}
      </div>
    </div>
    <template #nested>
      <div class="date-time-settings">
        <div class="date-time-settings__row date-time-settings__row--toggle">
          <span class="date-time-settings__label">{{ t('settings.dateTime.autoDetectRegionalFormat') }}</span>
          <Switch
            id="date-time-auto-regional"
            :model-value="autoDetectRegionalFormat"
            @update:model-value="autoDetectRegionalFormat = $event"
          />
        </div>

        <div
          v-if="!autoDetectRegionalFormat"
          class="date-time-settings__row date-time-settings__row--combobox"
        >
          <span class="date-time-settings__label">{{ t('settings.dateTime.regionalFormatLocale') }}</span>
          <BaseCombobox
            v-model="selectedRegionalLanguage"
            :options="languages"
            by="locale"
            :search-placeholder="t('search')"
            :empty-text="t('noData')"
            trigger-width="250px"
            class="date-time-settings__combobox"
          />
        </div>

        <div class="date-time-settings__row date-time-settings__row--toggle">
          <span class="date-time-settings__label">{{ t('settings.dateTime.monthFormat') }}</span>
          <Tabs
            v-model="monthFormatTab"
            class="date-time-settings__month-tabs"
          >
            <TabsList class="date-time-settings__tabs-list">
              <TabsTrigger
                value="numeric"
                class="date-time-settings__tab-trigger"
              >
                {{ t('settings.dateTime.numeric') }}
              </TabsTrigger>
              <TabsTrigger
                value="short"
                class="date-time-settings__tab-trigger"
              >
                {{ t('settings.dateTime.short') }}
              </TabsTrigger>
              <TabsTrigger
                value="long"
                class="date-time-settings__tab-trigger"
              >
                {{ t('settings.dateTime.long') }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div class="date-time-settings__row date-time-settings__row--toggle">
          <span class="date-time-settings__label">{{ t('settings.dateTime.12HourFormat') }}</span>
          <Switch
            id="date-time-hour12"
            :model-value="hour12"
            @update:model-value="hour12 = $event"
          />
        </div>

        <div class="date-time-settings__row date-time-settings__row--toggle">
          <span class="date-time-settings__label">{{ t('settings.dateTime.showSeconds') }}</span>
          <Switch
            id="date-time-show-seconds"
            :model-value="userSettingsStore.userSettings.dateTime.properties.showSeconds"
            @update:model-value="onShowSecondsChange"
          />
        </div>

        <div class="date-time-settings__row date-time-settings__row--toggle">
          <span class="date-time-settings__label">{{ t('settings.dateTime.showMilliseconds') }}</span>
          <Switch
            id="date-time-show-ms"
            :model-value="userSettingsStore.userSettings.dateTime.properties.showMilliseconds"
            @update:model-value="onShowMillisecondsChange"
          />
        </div>
      </div>
    </template>
  </SettingsItem>
</template>

<style scoped>
.date-time-settings__header-preview {
  display: flex;
  max-width: min(100%, 36rem);
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem 1rem;
}

.date-time-settings {
  display: flex;
  width: 100%;
  max-width: 100%;
  flex-direction: column;
  align-self: stretch;
  gap: 1rem;
}

.date-time-settings__preview-value {
  max-width: min(100%, 28rem);
  padding: 0.5rem 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.date-time-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.date-time-settings__row--toggle {
  gap: 2rem;
}

.date-time-settings__row--combobox {
  align-items: flex-start;
}

.date-time-settings__month-tabs {
  max-width: min(100%, 22rem);
  flex: 0 1 auto;
}

.date-time-settings__tabs-list {
  width: 100%;
  height: 2.25rem;
}

.date-time-settings__tab-trigger {
  min-width: 0;
  flex: 1 1 0;
}

.date-time-settings__label {
  flex: 1 1 12rem;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.date-time-settings__combobox {
  max-width: 100%;
  flex: 1 1 200px;
}
</style>
