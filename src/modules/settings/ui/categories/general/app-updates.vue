<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowUpCircleIcon, ExternalLinkIcon, LoaderCircleIcon, CheckCircleIcon, AlertCircleIcon,
} from 'lucide-vue-next';
import { SettingsItem } from '@/modules/settings';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useAppUpdater } from '@/modules/app-updater';
import externalLinks from '@/data/external-links';
import { openUrl } from '@tauri-apps/plugin-opener';

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const {
  isChecking,
  updateAvailable,
  updateInfo,
  lastCheckError,
  currentVersion,
  checkForUpdates,
  onAutoCheckSettingChanged,
} = useAppUpdater();

const hasCheckedOnce = ref(false);

const autoCheck = computed({
  get: () => userSettingsStore.userSettings.appUpdates.autoCheck,
  set: async (value: boolean) => {
    await userSettingsStore.set('appUpdates.autoCheck', value);
    onAutoCheckSettingChanged(value);
  },
});

async function handleCheckForUpdates() {
  await checkForUpdates();
  hasCheckedOnce.value = true;
}

async function openReleasesPage() {
  await openUrl(externalLinks.githubAllReleases);
}

async function openDownloadLink() {
  if (updateInfo.value?.releaseUrl) {
    await openUrl(updateInfo.value.releaseUrl);
  }
}
</script>

<template>
  <SettingsItem
    :title="t('appUpdates')"
    :icon="ArrowUpCircleIcon"
  >
    <template #description>
      <div class="app-updates__version">
        <span class="app-updates__version-label">
          {{ t('currentVersion') }}:
        </span>
        <span
          v-if="currentVersion"
          class="app-updates__version-value"
        >
          {{ currentVersion }}
        </span>
        <Skeleton
          v-else
          class="app-updates__version-skeleton"
        />
      </div>

      <div
        v-if="updateAvailable && updateInfo"
        class="app-updates__status app-updates__status--available"
      >
        <ArrowUpCircleIcon :size="16" />
        <span>
          {{ `${t('appUpdates')}: v${updateInfo.latestVersion}` }}
        </span>
      </div>

      <div
        v-else-if="hasCheckedOnce && !isChecking && !updateAvailable && !lastCheckError"
        class="app-updates__status app-updates__status--up-to-date"
      >
        <CheckCircleIcon :size="16" />
        <span>
          {{ t('notifications.noUpdatesAvailable') }}
        </span>
      </div>

      <div
        v-if="lastCheckError"
        class="app-updates__status app-updates__status--error"
      >
        <AlertCircleIcon :size="16" />
        <span>
          {{ lastCheckError }}
        </span>
      </div>

      <div class="app-updates__actions">
        <Button
          variant="secondary"
          size="xs"
          :disabled="isChecking"
          @click="handleCheckForUpdates"
        >
          <LoaderCircleIcon
            v-if="isChecking"
            :size="16"
            class="app-updates__spinner"
          />
          <ArrowUpCircleIcon
            v-else
            :size="16"
          />
          {{ t('checkUpdatesNow') }}
        </Button>

        <Button
          v-if="updateAvailable && updateInfo"
          variant="secondary"
          size="xs"
          @click="openDownloadLink"
        >
          <ExternalLinkIcon :size="16" />
          {{ `${t('download')} v${updateInfo.latestVersion}` }}
        </Button>

        <Button
          variant="ghost"
          size="xs"
          @click="openReleasesPage"
        >
          <ExternalLinkIcon :size="16" />
          {{ t('seeAllReleases') }}
        </Button>
      </div>
    </template>

    <div class="app-updates__settings">
      <div class="app-updates__toggle">
        <label
          for="auto-check-updates"
          class="app-updates__label"
        >
          {{ t('settings.general.checkForUpdatesAutomatically') }}
        </label>
        <Switch
          id="auto-check-updates"
          :model-value="autoCheck"
          @update:model-value="autoCheck = $event"
        />
      </div>
    </div>
  </SettingsItem>
</template>

<style scoped>
.app-updates__settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.app-updates__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.app-updates__label {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.app-updates__version {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-updates__version-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.app-updates__version-value {
  color: hsl(var(--foreground));
  font-family: monospace;
  font-size: 0.875rem;
}

.app-updates__version-skeleton {
  width: 7rem;
  height: 1rem;
}

.app-updates__status {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  gap: 0.5rem;
}

.app-updates__status--available {
  color: hsl(var(--primary));
}

.app-updates__status--up-to-date {
  color: hsl(142deg 71% 45%);
}

.app-updates__status--error {
  color: hsl(var(--destructive));
}

.app-updates__actions {
  display: flex;
  flex-wrap: wrap;
  margin-top: 12px;
  gap: 0.5rem;
}

.app-updates__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
