<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {ActionToolbar} from '@/components/navigator/action-toolbar';
import {Content} from '@/components/navigator/content';
import {InfoPanel} from '@/components/navigator/info-panel';
import {useUserSettingsStore} from '@/stores/storage/user-settings';
import {useWorkspacesStore} from '@/stores/storage/workspaces';

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
  <div class="navigator-page">
    <ActionToolbar />
    <InfoPanel />
    <Content
      v-if="workspacesStore.currentWorkspace"
      :current-workspace="workspacesStore.currentWorkspace"
    />
  </div>
</template>

<style>
.navigator-page {
  height: 100%;
}
</style>