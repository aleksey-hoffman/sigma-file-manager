<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Button } from '@/components/ui/button';
import { SettingsItem } from '@/modules/settings';
import { useUserPathsStore } from '@/stores/storage/user-paths';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { DatabaseIcon, FolderOpenIcon } from 'lucide-vue-next';

const { t } = useI18n();
const router = useRouter();
const userPathsStore = useUserPathsStore();
const workspacesStore = useWorkspacesStore();

async function navigateToUserDataDirectory() {
  const userDataDir = userPathsStore.customPaths.appUserDataDir;

  if (userDataDir) {
    await workspacesStore.openNewTabGroup(userDataDir);
    router.push({ name: 'navigator' });
  }
}
</script>

<template>
  <SettingsItem
    :title="t('settings.stats.title')"
    :description="t('settings.stats.description')"
    :icon="DatabaseIcon"
  >
    <Button
      variant="outline"
      @click="navigateToUserDataDirectory"
    >
      <FolderOpenIcon class="user-data__button-icon" />
      {{ t('settings.stats.openDataDirectory') }}
    </Button>
  </SettingsItem>
</template>

<style scoped>
.user-data__button-icon {
  width: 16px;
  height: 16px;
}
</style>
