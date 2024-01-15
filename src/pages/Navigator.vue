<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {NavigatorActionToolbar} from '@/components/NavigatorActionToolbar';
import {NavigatorInfoPanel} from '@/components/NavigatorInfoPanel';
import {NavigatorContent} from '@/components/NavigatorContent';
import {useWorkspacesStore} from '@/stores/storage/workspaces';
import {useUserSettingsStore} from '@/stores/storage/userSettings';

const userSettingsStore = useUserSettingsStore();
const workspacesStore = useWorkspacesStore();

function initInfoPanel() {
  if (userSettingsStore.userSettings.navigator.infoPanel.show) {
    setTimeout(() => {
      userSettingsStore.userSettings.navigator.infoPanel.show = true;
    }, 500);
  }
}

initInfoPanel();
</script>

<template>
  <NavigatorActionToolbar />
  <NavigatorInfoPanel />
  <div class="navigator-page">
    <NavigatorContent
      v-if="workspacesStore.currentWorkspace"
      :current-workspace="workspacesStore.currentWorkspace"
    />
  </div>
</template>

<style>
.navigator-page {
  height: 100%;
  background-color: var(--bg-color-darker-1);
}
</style>