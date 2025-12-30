<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window';
import { MinusIcon, SquareIcon, XIcon } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

const { t } = useI18n();
const appWindow = getCurrentWindow();

function minimizeWindow() {
  appWindow.minimize();
}

function maximizeWindow() {
  appWindow.toggleMaximize();
}

function closeWindow() {
  appWindow.close();
}
</script>

<template>
  <div class="window-actions">
    <Tooltip>
      <TooltipTrigger as-child>
        <div
          class="window-toolbar-button"
          @click="minimizeWindow"
        >
          <MinusIcon
            class="window-toolbar-button-icon"
            :size="16"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {{ t('window.minimizeWindow') }}
      </TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <div
          class="window-toolbar-button"
          @click="maximizeWindow"
        >
          <SquareIcon
            class="window-toolbar-button-icon"
            :size="14"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {{ t('window.toggleWindowSize') }}
      </TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger as-child>
        <div
          class="window-toolbar-button window-toolbar-button--red"
          @click="closeWindow"
        >
          <XIcon
            class="window-toolbar-button-icon"
            :size="18"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {{ t('window.closeWindow') }}
      </TooltipContent>
    </Tooltip>
  </div>
</template>

<style scoped>
.window-actions {
  z-index: 2;
  display: flex;
}

.window-toolbar-button {
  display: inline-flex;
  width: 46px;
  height: var(--window-toolbar-height);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
}

.window-toolbar-button:hover {
  background: hsl(var(--foreground) / 10%);
}

.window-toolbar-button-icon {
  stroke: hsl(var(--foreground) / 50%);
}

.window-toolbar-button--red:hover {
  background: hsl(var(--destructive) / 50%);
}
</style>
