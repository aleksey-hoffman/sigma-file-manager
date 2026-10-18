<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  BlocksIcon, CloudIcon, HardDriveIcon, NetworkIcon, UsbIcon,
} from '@lucide/vue';
import { useAppStore } from '@/stores/runtime/app';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import {
  BUILTIN_NAVIGATION_PAGE_SHORTCUTS,
  useShortcutsStore,
} from '@/stores/runtime/shortcuts';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { openNavigatorPath, openNavigatorPathInNewTab } from '@/utils/open-navigator-directory';
import { getDriveShortLabel as getDriveShortLabelFromMountPoint } from '@/utils/drive-short-label';
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
import RemoteNavPanel from './components/remote-nav-panel.vue';
import { resolveRemoteOpenPanes } from '@/modules/remote/utils/remote-panes';
import { buildRemoteConnectionPath } from '@/utils/remote-paths';
import type { RemoteConnection } from '@/types/remote';
import UbuntuWslIcon from '@/components/icons/ubuntu-wsl-icon.vue';
import { useTextDirection } from '@/composables/use-text-direction';

const router = useRouter();
const appStore = useAppStore();
const extensionsStore = useExtensionsStore();
const shortcutsStore = useShortcutsStore();
const userSettingsStore = useUserSettingsStore();
const workspacesStore = useWorkspacesStore();
const { drives } = useDrives();
const { inlineEndSide } = useTextDirection();

const quickAccessOnHover = computed(() => userSettingsStore.userSettings.quickAccessOnHover);

const quickAccessContextMenuOpenCount = ref(0);
provide(CONTEXT_MENU_OPEN_COUNT_KEY, quickAccessContextMenuOpenCount);

const quickAccessHoverOpen = ref(false);
const quickAccessReorderOpen = ref(false);
const quickAccessTooltipOpen = computed(() =>
  quickAccessHoverOpen.value
  || quickAccessContextMenuOpenCount.value > 0
  || quickAccessReorderOpen.value,
);

function handleQuickAccessTooltipOpenChange(value: boolean) {
  quickAccessHoverOpen.value = value;
}

function handleQuickAccessReorderStart() {
  quickAccessReorderOpen.value = true;
}

function handleQuickAccessReorderEnd() {
  quickAccessHoverOpen.value = true;
  quickAccessReorderOpen.value = false;
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

function getPageShortcutLabel(routeName: unknown): string {
  const shortcut = BUILTIN_NAVIGATION_PAGE_SHORTCUTS.find(
    item => item.routeName === routeName,
  );

  return shortcut ? shortcutsStore.getShortcutLabel(shortcut.id) : '';
}

function getExtensionPageShortcutLabel(pageId: string): string {
  const keybinding = extensionsStore.getSidebarPageKeybinding(pageId);
  return keybinding?.keys?.key ? formatKeybindingKeys(keybinding.keys) : '';
}

function openDrive(path: string) {
  openNavigatorPath(router, path);
}

function handleDriveMouseDown(event: MouseEvent, path: string) {
  if (event.button !== 1) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  openNavigatorPathInNewTab(router, path);
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

/**
 * 从挂载点提取用于窄侧栏标识的短标签（2026-10-11）。
 * 实现在 @/utils/drive-short-label，抽出是为了能单独写单测。
 */
function getDriveShortLabel(drive: { mount_point: string }): string {
  return getDriveShortLabelFromMountPoint(drive.mount_point);
}

// ---------------------------------------------------------------------------
// 远程（2026-10-18）
//
// 面板是 hover 驱动的，开合状态自己管 —— 跟上面「仪表盘」那块同一个模式，
// 用 Tooltip 的受控 `:open` 而不是让它自己判断，鼠标从按钮移到面板上时
// 才不会闪一下。
// ---------------------------------------------------------------------------

const remotePanelOpen = ref(false);

function handleRemotePanelOpenChange(value: boolean) {
  remotePanelOpen.value = value;
}

function openRemoteSettings() {
  remotePanelOpen.value = false;
  void router.push({ name: 'settings' });
}

/**
 * 连一个远程：开一组标签页，左本地右远端。
 *
 * 摆几格完全交给 `resolveRemoteOpenPanes` 判定（连接有本地目录 → 两格，
 * 否则一格）。**不在这里自己 if 一次**：判定逻辑在别处、也已被测过，
 * 这里再抄一遍就是两份真相。
 */
async function openRemoteConnection(connection: RemoteConnection) {
  remotePanelOpen.value = false;

  const remotePath = buildRemoteConnectionPath(connection.id);

  if (!remotePath) {
    return;
  }

  const panes = resolveRemoteOpenPanes(remotePath, [connection]);
  await workspacesStore.openNewTabGroupWithPaths(panes.map(pane => pane.path));
}
</script>

<template>
  <div
    class="nav-sidebar"
    data-e2e-root="nav-sidebar"
  >
    <div
      class="nav-sidebar-header"
      data-tauri-drag-region
    >
      <div class="nav-sidebar-header-logo">
        <img
          data-tauri-drag-region
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
            :side="inlineEndSide"
            align="start"
            :side-offset="12"
            :collision-padding="6"
            class="nav-sidebar__quick-access-tooltip"
          >
            <!-- FORK-MODIFICATION: 需求 N3① —— 删掉「仪表盘 Alt+3」这行标题。
                 面板内容本身就是仪表盘快捷入口，标题行是重复信息。
                 Alt+3 快捷键本身不变（`BUILTIN_NAVIGATION_PAGE_SHORTCUTS`），
                 仍可用，也仍在设置页展示。 -->
            <QuickAccessPanel
              @drag-start="handleQuickAccessReorderStart"
              @drag-end="handleQuickAccessReorderEnd"
            />
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
            :side="inlineEndSide"
            :side-offset="12"
          >
            <div class="nav-sidebar__tooltip-row">
              <span>{{ item.title }}</span>
              <ContextMenuShortcut v-if="getPageShortcutLabel(item.name)">
                {{ getPageShortcutLabel(item.name) }}
              </ContextMenuShortcut>
            </div>
          </TooltipContent>
        </Tooltip>
      </template>

      <Tooltip
        :open="remotePanelOpen"
        @update:open="handleRemotePanelOpenChange"
      >
        <TooltipTrigger as-child>
          <Button
            class="nav-sidebar-item"
            size="icon"
            data-test="remote-nav-button"
          >
            <CloudIcon
              :size="18"
              class="nav-sidebar-item-icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          :side="inlineEndSide"
          align="start"
          :side-offset="12"
          :collision-padding="6"
          class="nav-sidebar__remote-tooltip"
        >
          <RemoteNavPanel
            @open-settings="openRemoteSettings"
            @open="openRemoteConnection"
          />
        </TooltipContent>
      </Tooltip>

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
          :side="inlineEndSide"
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
            @mousedown="handleDriveMouseDown($event, drive.path)"
          >
            <span class="nav-sidebar-drive-stack">
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
              <span class="nav-sidebar-drive-label">{{ getDriveShortLabel(drive) }}</span>
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent
          :side="inlineEndSide"
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

/*
 * 图标 + 盘符的纵向叠放容器（2026-10-11）。
 *
 * 用 overlay 而不是 flex 列布局，是为了**不改变按钮高度** ——
 * 侧栏里可能同时挂着十几个盘（网络盘 + U 盘），
 * 若每个按钮因加字而变高，底部空间不够时整列会被挤变形。
 * 字标绝对定位在图标下缘，向上溢出可见，容器尺寸保持 24x24 不变。
 */

.nav-sidebar-drive-stack {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

/*
 * 盘符字标：与图标合成一个整体（2026-10-11 第三轮）。
 *
 * 第一轮放在图标**下方**，两者是分离的两个元素，视觉上像两样东西。
 * 第三轮按用户意见改成：压到图标上、只留字母、字母放大。
 *
 * 实现要点：
 *
 * 1. 去掉冒号，只留字母。侧栏仅 24px 宽，字高已放到 12px，
 *    冒号在这个尺寸不增加辨识度、却占掉描边留白，反而让字母更难认。
 *    认错分区是要付代价的，所以宁小勿杂。
 *
 * 2. `transform: translate(-50%, 10%)` 让字标顶边压到容器垂直中线略下方，
 *    即字标上部压进图标下部、重叠约 56.7%。
 *    取值来自逐档实测（12px 字 / 16px 图标，用 getBoundingClientRect 量重叠），
 *    由用户从对照图里选定这一档：
 *        0% → 66.7%   10% → 56.7% ← 当前值
 *       18% → 48.7%   25% → 41.7%
 *       32% → 34.7%   40% → 26.7%
 *    0% 会压得太深、字母下半截沉进图标里显糊；40% 只剩 1/4 叠合，
 *    「合成一体」的效果弱了。10% 是观感与辨识度的平衡点。
 *
 * 3. 描边用 `background-2`（侧栏自身底色）而不是固定灰：
 *    浅色主题下是浅灰、深色主题下是深灰，永远与所在面板同色，
 *    等于把图标线条从字上「抠断」，切任何主题都不会糊。
 *    `paint-order: stroke fill` 保证描边画在字形**下面**而非盖住字 ——
 *    实测去掉它，字几乎完全消失（见 scripts/drive-label-preview.html 的对照B）。
 *
 * 4. 描边宽度 2px 是可读性下限：再窄图标线条就会重新穿进字里。
 */

.nav-sidebar-drive-label {
  position: absolute;
  top: 50%;
  left: 50%;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
  paint-order: stroke fill;
  pointer-events: none;
  -webkit-text-stroke: 2px hsl(var(--background-2));
  transform: translate(-50%, 10%);
  white-space: nowrap;
}

/*
 * 悬停/聚焦时才提亮图标与字标。
 * 默认态保持 muted，避免一列盘符全部高亮导致视觉噪音。
 *
 * 刻意只改 color 不改 -webkit-text-stroke：
 * 描边必须始终等于侧栏底色，悬停时若跟着变色，
 * 描边就盖不住图标线条了，「合成一体」的效果会消失。
 */

.nav-sidebar-drive:hover .nav-sidebar-drive-icon {
  color: hsl(var(--foreground));
  stroke: hsl(var(--foreground));
}

.nav-sidebar-drive:hover .nav-sidebar-drive-label {
  color: hsl(var(--foreground));
}

</style>

<style>
.sigma-ui-tooltip-content.nav-sidebar__quick-access-tooltip {
  overflow: visible;
  padding: 0;
  border: 1px solid hsl(var(--border) / 50%);
  margin-top: 0;
}

/* FORK-MODIFICATION: 需求 N3① 删掉「仪表盘 Alt+3」标题行后，
   原 `.nav-sidebar__quick-access-title` 已无对应元素，一并删除。 */

.nav-sidebar-drive-tooltip {
  padding: 0;
  border: none;
  background: transparent;
}

/* 远程面板与盘符面板一样，去掉气泡自身的内边距与边框，由面板自己排版。 */
.sigma-ui-tooltip-content.nav-sidebar__remote-tooltip {
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
