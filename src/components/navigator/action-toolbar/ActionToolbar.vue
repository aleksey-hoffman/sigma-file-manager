<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {ActionToolbar} from '@/components/app/action-toolbar';
import {Button} from '@/components/ui/button';
import {Spacer} from '@/components/ui/spacer';
import {useUserSettingsStore} from '@/stores/storage/user-settings';
import {useWorkspacesStore} from '@/stores/storage/workspaces';

const userSettingsStore = useUserSettingsStore();
const workspacesStore = useWorkspacesStore();
</script>

<template>
  <ActionToolbar>
    <Button
      button-class="action-toolbar__item"
      icon="mdi:flip-horizontal"
      icon-size="18px"
      icon-class="action-toolbar__icon"
      :tooltip="$t('navigator.toggleSplitView')"
      @click="workspacesStore.toggleSplitView()"
    />

    <Spacer />

    <Button
      button-class="action-toolbar__item"
      icon="mdi-dock-right"
      icon-size="18px"
      icon-class="action-toolbar__icon"
      :tooltip="$t('navigator.toggleInfoPanel')"
      @click="userSettingsStore.toggleInfoPanel()"
    />
  </ActionToolbar>
</template>