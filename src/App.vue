<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {listen} from '@tauri-apps/api/event';
import {WindowToolbar} from '@/components/WindowToolbar';
import {NavPanel} from '@/components/NavPanel';
import {RouterView} from '@/components/RouterView';
import {useUserSettingsStore} from '@/stores/storage/userSettings';
import {useWorkspacesStore} from '@/stores/storage/workspaces';
import {useUserPathsStore} from '@/stores/storage/userPaths';
import {disableWebViewFeatures} from '@/utils/disableWebViewFeatures';

const userSettingsStore = useUserSettingsStore();
const workspacesStore = useWorkspacesStore();
const userPathsStore = useUserPathsStore();

async function initMainProcessListeners() {
  await listen('reload-window', () => window.location.reload());
}

async function init() {
  await userPathsStore.init();
  disableWebViewFeatures();
  initMainProcessListeners();
  workspacesStore.preloadDefaultTab();
}

init();
</script>

<template>
  <VApp :theme-type="userSettingsStore.userSettings.theme.type">
    <WindowToolbar />
    <NavPanel />
    <RouterView />
  </VApp>
</template>

<style>
@import url("./styles/index.css");

.v-main,
.v-app,
#app {
  height: 100vh;
}

.v-main
  .router-view {
    height: 100vh;
  }
</style>