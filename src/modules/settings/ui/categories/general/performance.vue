<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { GaugeIcon } from '@lucide/vue';
import { SettingsItem } from '@/modules/settings';
import { Switch } from '@/components/ui/switch';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { applyAuxiliaryWindowPrelaunchSetting } from '@/utils/auxiliary-windows';

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();

const prelaunchQuickViewWindow = computed(
  () => userSettingsStore.userSettings.performance.prelaunchQuickViewWindow,
);
const prelaunchPrintViewWindow = computed(
  () => userSettingsStore.userSettings.performance.prelaunchPrintViewWindow,
);

async function onPrelaunchQuickViewWindowChange(enabled: boolean) {
  await userSettingsStore.set('performance.prelaunchQuickViewWindow', enabled);
  await applyAuxiliaryWindowPrelaunchSetting('quick-view', enabled);
}

async function onPrelaunchPrintViewWindowChange(enabled: boolean) {
  await userSettingsStore.set('performance.prelaunchPrintViewWindow', enabled);
  await applyAuxiliaryWindowPrelaunchSetting('print-view', enabled);
}
</script>

<template>
  <SettingsItem
    :title="t('settings.general.performance.title')"
    :icon="GaugeIcon"
  >
    <template #nested>
      <div class="performance-settings">
        <div class="performance-settings__row">
          <div class="performance-settings__copy">
            <span class="performance-settings__label">
              {{ t('settings.general.performance.prelaunchQuickViewWindow') }}
            </span>
            <p class="performance-settings__description">
              {{ t('settings.general.performance.prelaunchQuickViewWindowDescription') }}
            </p>
          </div>
          <Switch
            :model-value="prelaunchQuickViewWindow"
            @update:model-value="onPrelaunchQuickViewWindowChange"
          />
        </div>

        <div class="performance-settings__row">
          <div class="performance-settings__copy">
            <span class="performance-settings__label">
              {{ t('settings.general.performance.prelaunchPrintViewWindow') }}
            </span>
            <p class="performance-settings__description">
              {{ t('settings.general.performance.prelaunchPrintViewWindowDescription') }}
            </p>
          </div>
          <Switch
            :model-value="prelaunchPrintViewWindow"
            @update:model-value="onPrelaunchPrintViewWindowChange"
          />
        </div>
      </div>
    </template>
  </SettingsItem>
</template>

<style scoped>
.performance-settings {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 1rem;
}

.performance-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem 2rem;
}

.performance-settings__copy {
  display: flex;
  min-width: min(100%, 16rem);
  flex: 1 1 12rem;
  flex-direction: column;
}

.performance-settings__label {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.performance-settings__description {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  line-height: 1.4;
}
</style>
