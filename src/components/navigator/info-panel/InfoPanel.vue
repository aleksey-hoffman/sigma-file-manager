<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {InfoPanelHeader, InfoPanelPreview, InfoPanelProperties} from '@/components/navigator/info-panel';
import {useUserSettingsStore} from '@/stores/storage/user-settings';

const userSettingsStore = useUserSettingsStore();
</script>

<template>
  <div
    v-if="userSettingsStore.userSettings.navigator.infoPanel.show"
    class="navigator-info-panel"
  >
    <InfoPanelPreview />
    <InfoPanelHeader />
    <InfoPanelProperties />
  </div>
</template>

<style>
.navigator-info-panel {
  overflow: hidden;
  background-color: var(--info-panel-bg-color);
  box-shadow: var(--info-panel-shadow);
}
</style>