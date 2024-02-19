<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {listen} from '@tauri-apps/api/event';
import {NavSidebar} from '@/components/app/nav-sidebar';
import {RouterView} from '@/components/app/router-view';
import {WindowToolbar} from '@/components/app/window-toolbar';
import {useUserPathsStore} from '@/stores/storage/user-paths';
import {useUserSettingsStore} from '@/stores/storage/user-settings';
import {useWorkspacesStore} from '@/stores/storage/workspaces';
import {disableWebViewFeatures} from '@/utils/disable-web-view-features';

const userSettingsStore = useUserSettingsStore();
const workspacesStore = useWorkspacesStore();
const userPathsStore = useUserPathsStore();

async function initMainProcessListeners() {
  await listen('reload-window', () => window.location.reload());
}

async function init() {
  await userPathsStore.init();
  await userSettingsStore.init();
  disableWebViewFeatures();
  initMainProcessListeners();
  workspacesStore.preloadDefaultTab();
}

init();
</script>

<template>
  <NavSidebar />
  <div class="app-main">
    <WindowToolbar />
    <RouterView />
  </div>
</template>

<style>
@import url("./styles/index.css");

#app {
  display: flex;
  height: 100vh;
  background-color: hsl(var(--background));
  color: hsl(var(--foreground)/ 50%);
}

.app-main {
  width: 100%;
  height: 100%;
}
</style>