<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RocketIcon } from '@lucide/vue';
import { SettingsItem } from '@/modules/settings';
import SettingsAvailabilityBadge from '@/modules/settings/ui/availability-badge.vue';
import { Switch } from '@/components/ui/switch';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { usePlatformStore } from '@/stores/runtime/platform';
import { applyLaunchAtStartupPreference } from '@/utils/autostart-sync';

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const platformStore = usePlatformStore();

const launchAtStartup = computed(() => userSettingsStore.userSettings.launchAtStartup);
const launchAtStartupHidden = computed(() => userSettingsStore.userSettings.launchAtStartupHidden);

async function onLaunchAtStartupChange(enabled: boolean) {
  try {
    await applyLaunchAtStartupPreference(enabled);
    await userSettingsStore.set('launchAtStartup', enabled);

    if (!enabled && launchAtStartupHidden.value) {
      await userSettingsStore.set('launchAtStartupHidden', false);
    }
  }
  catch (error) {
    console.error('Failed to update launch at startup:', error);
  }
}

async function onLaunchAtStartupHiddenChange(enabled: boolean) {
  await userSettingsStore.set('launchAtStartupHidden', enabled);
}
</script>

<template>
  <SettingsItem
    :title="t('settings.general.startupBehavior')"
    :icon="RocketIcon"
  >
    <template #title-suffix>
      <SettingsAvailabilityBadge v-if="platformStore.isPortable">
        {{ t('settings.unavailableInPortableVersion') }}
      </SettingsAvailabilityBadge>
    </template>
    <div class="startup-section">
      <div class="startup-section__toggle">
        <label
          for="launch-at-startup"
          class="startup-section__label"
        >
          {{ t('settings.general.launchAppOnSystemLogin') }}
        </label>
        <Switch
          id="launch-at-startup"
          :disabled="platformStore.isPortable"
          :model-value="launchAtStartup"
          @update:model-value="onLaunchAtStartupChange"
        />
      </div>
      <div class="startup-section__toggle">
        <label
          for="launch-at-startup-hidden"
          class="startup-section__label"
        >
          {{ t('settings.general.launchAppInHiddenState') }}
        </label>
        <Switch
          id="launch-at-startup-hidden"
          :disabled="platformStore.isPortable || !launchAtStartup"
          :model-value="launchAtStartupHidden"
          @update:model-value="onLaunchAtStartupHiddenChange"
        />
      </div>
    </div>
  </SettingsItem>
</template>

<style scoped>
.startup-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.startup-section__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.startup-section__label {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}
</style>
