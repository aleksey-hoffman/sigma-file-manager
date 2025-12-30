<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { HardDriveIcon, UsbIcon } from 'lucide-vue-next';
import { useAppStore } from '@/stores/runtime/app';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useDrives } from '@/modules/home/composables';
import { DriveCard } from '@/modules/home/components';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

const router = useRouter();
const appStore = useAppStore();
const workspacesStore = useWorkspacesStore();
const { drives } = useDrives();

async function openDrive(path: string) {
  await workspacesStore.openNewTabGroup(path);
  router.push({ name: 'navigator' });
}
</script>

<template>
  <div class="nav-sidebar">
    <div class="nav-sidebar-header">
      <div class="nav-sidebar-header-logo">
        <img
          src="@/assets/icons/logo-32x32.png"
          width="20"
          height="20"
        >
      </div>
    </div>

    <div class="nav-sidebar-items">
      <Tooltip
        v-for="(item, index) in appStore.pages"
        :key="index"
        :delay-duration="0"
      >
        <TooltipTrigger as-child>
          <Button
            class="nav-sidebar-item"
            size="icon"
            :value="item.name"
            :is-active="item.name === router.currentRoute.value.name"
            @click="router.push({ name: item.name })"
          >
            <component
              :is="item.icon"
              :size="18"
              class="nav-sidebar-item-icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          :side-offset="12"
        >
          {{ item.title }}
        </TooltipContent>
      </Tooltip>
    </div>

    <div class="nav-sidebar-spacer" />

    <div class="nav-sidebar-drives">
      <Tooltip
        v-for="drive in drives"
        :key="drive.path"
        :delay-duration="0"
      >
        <TooltipTrigger as-child>
          <Button
            class="nav-sidebar-drive"
            size="icon"
            @click="openDrive(drive.path)"
          >
            <component
              :is="drive.is_removable ? UsbIcon : HardDriveIcon"
              :size="16"
              class="nav-sidebar-drive-icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          :side-offset="12"
          :collision-padding="6"
          class="nav-sidebar-drive-tooltip"
        >
          <DriveCard :drive="drive" />
        </TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>

<style scoped>
.nav-sidebar {
  display: flex;
  width: var(--nav-sidebar-width);
  height: calc(100vh - 12px);
  flex-direction: column;
  border-radius: var(--radius-sm);
  margin: 6px;
  background-color: hsl(var(--background-2));
}

.nav-sidebar-header {
  display: flex;
  height: var(--window-toolbar-height);
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
  background-color: hsl(var(--background-2));
}

.nav-sidebar-items {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px;
  gap: 12px;
}

.nav-sidebar-spacer {
  flex: 1;
}

.nav-sidebar-drives {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: center;
  padding: 4px;
  padding-bottom: 12px;
  gap: 8px;
}

.nav-sidebar-item {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background-color: transparent;
  cursor: pointer;
}

.nav-sidebar-item:hover {
  background-color: hsl(var(--foreground) / 3%);
}

.nav-sidebar-item[is-active="true"] {
  background-color: hsl(var(--foreground) / 5%);
}

.nav-sidebar-item-icon {
  stroke: hsl(var(--icon));
}

.nav-sidebar-item[is-active="true"] .nav-sidebar-item-icon {
  stroke: hsl(var(--primary));
}

.nav-sidebar-drive {
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background-color: transparent;
  cursor: pointer;
}

.nav-sidebar-drive:hover {
  background-color: hsl(var(--foreground) / 3%);
}

.nav-sidebar-drive-icon {
  stroke: hsl(var(--muted-foreground));
}

.nav-sidebar-drive:hover .nav-sidebar-drive-icon {
  stroke: hsl(var(--foreground));
}
</style>

<style>
.nav-sidebar-drive-tooltip {
  padding: 0;
  border: none;
  background: transparent;
}

.nav-sidebar-drive-tooltip .drive-card {
  min-width: 260px;
}
</style>
