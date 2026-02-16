<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { SparklesIcon } from 'lucide-vue-next';
import { SettingsItem } from '@/modules/settings';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useChangelog } from '@/modules/changelog';

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const { open, appVersion } = useChangelog();

const showOnUpdate = computed({
  get: () => userSettingsStore.userSettings.changelog.showOnUpdate,
  set: async (value: boolean) => {
    await userSettingsStore.set('changelog.showOnUpdate', value);
  },
});

function openChangelog() {
  open();
}
</script>

<template>
  <SettingsItem
    :title="t('changelog.settingsTitle')"
    :icon="SparklesIcon"
  >
    <template #description>
      <div>
        {{ t('changelog.settingsDescription') }}
      </div>

      <Button
        variant="secondary"
        size="xs"
        class="whats-new-settings__button"
        @click="openChangelog"
      >
        <SparklesIcon :size="16" />
        {{ t('changelog.viewChangelog') }}
      </Button>
    </template>
    <div class="whats-new-settings">
      <div class="whats-new-settings__toggle">
        <label
          for="show-changelog-on-update"
          class="whats-new-settings__label"
        >
          {{ t('changelog.showOnUpdate') }}
        </label>
        <Switch
          id="show-changelog-on-update"
          :model-value="showOnUpdate"
          @update:model-value="showOnUpdate = $event"
        />
      </div>
    </div>
  </SettingsItem>
</template>

<style scoped>
.whats-new-settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.whats-new-settings__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.whats-new-settings__label {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.whats-new-settings__button {
  margin-top: 12px;
  gap: 0.5rem;
}
</style>
