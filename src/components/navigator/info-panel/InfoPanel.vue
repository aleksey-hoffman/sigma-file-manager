<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {InfoPanelHeader, InfoPanelPreview, InfoPanelProperties} from '@/components/navigator/info-panel';
import {useUserSettingsStore} from '@/stores/storage/user-settings';
import getVar from '@/utils/get-var';

const userSettingsStore = useUserSettingsStore();
</script>

<template>
  <VNavigationDrawer
    v-model="userSettingsStore.userSettings.navigator.infoPanel.show"
    location="right"
    permanent
    class="navigator-info-panel"
    :width="getVar('info-panel-width-value')"
  >
    <InfoPanelPreview />
    <InfoPanelHeader />
    <InfoPanelProperties />
  </VNavigationDrawer>
</template>

<style>
.navigator-info-panel {
  overflow: hidden;
  background-color: var(--info-panel-bg-color);
  box-shadow: var(--info-panel-shadow);
}
</style>