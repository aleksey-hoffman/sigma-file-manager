<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import { useRouter } from 'vue-router';
import { BlocksIcon, HardDriveIcon, NetworkIcon, UsbIcon } from '@lucide/vue';
import { useAppStore } from '@/stores/runtime/app';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useDrives } from '@/modules/home/composables';
import { DriveCard } from '@/modules/home/components';
import { getLucideIcon } from '@/utils/lucide-icons';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { CONTEXT_MENU_OPEN_COUNT_KEY } from '@/components/dir-entry-interactive';
import { formatKeybindingKeys } from '@/modules/extensions/api';
import QuickAccessPanel from './components/quick-access-panel.vue';
import UbuntuWslIcon from '@/components/icons/ubuntu-wsl-icon.vue';

const router = useRouter();
const appStore = useAppStore();
const extensionsStore = useExtensionsStore();
const userSettingsStore = useUserSettingsStore();
const workspacesStore = useWorkspacesStore();
const { drives } = useDrives();

const quickAccessOnHover = computed(() => userSettingsStore.userSettings.quickAccessOnHover);

const quickAccessContextMenuOpenCount = ref(0);
provide(CONTEXT_MENU_OPEN_COUNT_KEY, quickAccessContextMenuOpenCount);

const quickAccessHoverOpen = ref(false);
const quickAccessTooltipOpen = computed(() =>
  quickAccessHoverOpen.value || quickAccessContextMenuOpenCount.value > 0,
);

function handleQuickAccessTooltipOpenChange(value: boolean) {
  quickAccessHoverOpen.value = value;
}

function isDashboardPage(item: { name?: unknown }) {
  return item.name === 'dashboard';
}

const sortedExtensionPages = computed(() => {
  return [...extensionsStore.sidebarPages].sort((a, b) => {
    const orderA = a.page.order ?? 0;
    const orderB = b.page.order ?? 0;
    return orderA - orderB;
  });
});

function isExtensionPageActive(pageId: string) {
  return router.currentRoute.value.name === 'extension-page'
    && router.currentRoute.value.params.fullPageId === pageId;
}

function openExtensionPage(pageId: string) {
  router.push({
    name: 'extension-page',
    params: { fullPageId: pageId },
  });
}

function getExtensionPageShortcutLabel(pageId: string): string {
  const keybinding = extensionsStore.getSidebarPageKeybinding(pageId);
  return keybinding?.keys?.key ? formatKeybindingKeys(keybinding.keys) : '';
}

async function openDrive(path: string) {
  await workspacesStore.openNewTabGroup(path);
  router.push({ name: 'navigator' });
}

function getDriveIcon(drive: {
  drive_type: string;
  is_removable: boolean;
}) {
  if (drive.drive_type === 'Network') {
    return NetworkIcon;
  }

  return drive.is_removable ? UsbIcon : HardDriveIcon;
}
</script>

<template>
  <div
    class="nav-sidebar"
    data-e2e-root="nav-sidebar"
  >
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
      <template
        v-for="(item, index) in appStore.pages"
        :key="index"
      >
        <Tooltip
          v-if="isDashboardPage(item) && quickAccessOnHover"
          :open="quickAccessTooltipOpen"
          @update:open="handleQuickAccessTooltipOpenChange"
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
            align="start"
            :side-offset="12"
            :collision-padding="6"
            class="nav-sidebar__quick-access-tooltip"
          >
            <QuickAccessPanel />
          </TooltipContent>
        </Tooltip>
        <Tooltip
          v-else
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
      </template>

      <Tooltip
        v-for="registration in sortedExtensionPages"
        :key="registration.page.id"
      >
        <TooltipTrigger as-child>
          <Button
            class="nav-sidebar-item"
            size="icon"
            :is-active="isExtensionPageActive(registration.page.id)"
            @click="openExtensionPage(registration.page.id)"
          >
            <component
              :is="getLucideIcon(registration.page.icon) ?? BlocksIcon"
              :size="18"
              class="nav-sidebar-item-icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          :side-offset="12"
        >
          <div class="nav-sidebar__tooltip-row">
            <span>{{ registration.page.title }}</span>
            <ContextMenuShortcut v-if="getExtensionPageShortcutLabel(registration.page.id)">
              {{ getExtensionPageShortcutLabel(registration.page.id) }}
            </ContextMenuShortcut>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>

    <div class="nav-sidebar-spacer" />

    <div class="nav-sidebar-drives">
      <Tooltip
        v-for="drive in drives"
        :key="drive.path"
      >
        <TooltipTrigger as-child>
          <Button
            class="nav-sidebar-drive"
            size="icon"
            @click="openDrive(drive.path)"
          >
            <UbuntuWslIcon
              v-if="drive.drive_type === 'WSL'"
              :size="16"
              class="nav-sidebar-drive-icon"
            />
            <component
              v-else
              :is="getDriveIcon(drive)"
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
  z-index: 10;
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
  color: hsl(var(--muted-foreground));
  stroke: hsl(var(--muted-foreground));
}

.nav-sidebar-drive:hover .nav-sidebar-drive-icon {
  color: hsl(var(--foreground));
  stroke: hsl(var(--foreground));
}

</style>

<style>
.nav-sidebar__quick-access-tooltip {
  padding: 0;
  border: none;
  margin-top: 0;
}

.nav-sidebar-drive-tooltip {
  padding: 0;
  border: none;
  background: transparent;
}

.nav-sidebar__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.nav-sidebar-drive-tooltip .drive-card {
  min-width: 260px;
}
</style>
