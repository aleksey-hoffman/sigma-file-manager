<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DirEntry } from '@/types/dir-entry';
import { ContextMenuSub } from 'reka-ui';
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { useTerminalsStore } from '@/stores/runtime/terminals';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { normalizeDefaultTerminalSettings, normalizeTerminalProgram, selectedDetectedTerminalId } from '@/utils/default-terminal';
import { basenameFromPath } from '@/utils/source-display-name';
import { getDirectoryPathFromEntry } from '@/utils/virtual-location-action-target';
import { isVirtualLocationPath } from '@/utils/virtual-path-constants';
import { ShieldIcon, TerminalSquareIcon } from '@lucide/vue';
import FileBrowserTerminalAdminHint from './file-browser-terminal-admin-hint.vue';

const props = defineProps<{
  selectedEntries: DirEntry[];
  isShiftHeld: boolean;
}>();

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();
const terminalsStore = useTerminalsStore();
const userSettingsStore = useUserSettingsStore();

const targetDirectoryPath = computed(() => {
  const firstEntry = props.selectedEntries[0];

  if (!firstEntry) {
    return null;
  }

  const path = getDirectoryPathFromEntry(firstEntry);

  if (!path || isVirtualLocationPath(path)) {
    return null;
  }

  return path;
});

const preferredTerminalId = computed(() => selectedDetectedTerminalId(
  userSettingsStore.userSettings.terminal,
  terminalsStore.terminals,
));

const preferredTerminal = computed(() => {
  const settings = normalizeDefaultTerminalSettings(userSettingsStore.userSettings.terminal);

  if (settings.mode === 'custom') {
    const program = normalizeTerminalProgram(settings.customCommand);

    if (!program) {
      return null;
    }

    return {
      name: basenameFromPath(program),
      icon: null,
    };
  }

  const detectedTerminal = terminalsStore.terminals.find(terminal => terminal.id === preferredTerminalId.value);

  if (!detectedTerminal) {
    return null;
  }

  return {
    name: detectedTerminal.name,
    icon: detectedTerminal.icon,
  };
});

const otherTerminals = computed(() => terminalsStore.terminals.filter(
  terminal => terminal.id !== preferredTerminalId.value,
));

async function handleOpenConfiguredTerminal() {
  if (!targetDirectoryPath.value) return;

  await terminalsStore.openConfiguredTerminal(targetDirectoryPath.value, props.isShiftHeld);
}

async function handleOpenTerminal(terminalId: string) {
  if (!targetDirectoryPath.value) return;

  await terminalsStore.openTerminal(targetDirectoryPath.value, terminalId, props.isShiftHeld);
}
</script>

<template>
  <ContextMenuSub>
    <ContextMenuSubTrigger class="terminal-submenu__trigger">
      <ShieldIcon
        v-if="isShiftHeld"
        :size="16"
      />
      <TerminalSquareIcon
        v-else
        :size="16"
      />
      <span>{{ t('terminal.openInTerminal') }}</span>
      <FileBrowserTerminalAdminHint
        is-main-menu-item
        shows-shortcut
      />
      <ContextMenuShortcut v-if="shortcutsStore.getShortcutLabel('openTerminal')">
        {{ shortcutsStore.getShortcutLabel('openTerminal') }}
      </ContextMenuShortcut>
    </ContextMenuSubTrigger>
    <ContextMenuSubContent class="terminal-submenu">
      <template v-if="preferredTerminal">
        <ContextMenuItem
          class="terminal-submenu__item"
          @select="handleOpenConfiguredTerminal"
        >
          <img
            v-if="preferredTerminal.icon"
            :src="preferredTerminal.icon"
            class="terminal-submenu__icon"
          >
          <TerminalSquareIcon
            v-else
            :size="16"
          />
          <span>{{ preferredTerminal.name }}</span>
          <span class="terminal-submenu__default-badge">
            {{ t('terminal.defaultLabel') }}
          </span>
          <FileBrowserTerminalAdminHint shows-shortcut />
        </ContextMenuItem>

        <ContextMenuSeparator v-if="otherTerminals.length > 0 || terminalsStore.loadError" />
      </template>

      <div
        v-if="terminalsStore.loadError"
        class="terminal-submenu__error"
      >
        {{ terminalsStore.loadError }}
      </div>

      <div
        v-else-if="!preferredTerminal && terminalsStore.hasLoaded && terminalsStore.terminals.length === 0"
        class="terminal-submenu__empty"
      >
        {{ t('terminal.noTerminalsFound') }}
      </div>

      <template v-else>
        <ContextMenuItem
          v-for="terminal in otherTerminals"
          :key="terminal.id"
          class="terminal-submenu__item"
          @select="handleOpenTerminal(terminal.id)"
        >
          <img
            v-if="terminal.icon"
            :src="terminal.icon"
            class="terminal-submenu__icon"
          >
          <TerminalSquareIcon
            v-else
            :size="16"
          />
          <span>{{ terminal.name }}</span>
          <FileBrowserTerminalAdminHint />
        </ContextMenuItem>
      </template>
    </ContextMenuSubContent>
  </ContextMenuSub>
</template>

<style>
.terminal-submenu {
  min-width: 200px;
  max-width: 350px;
}

.terminal-submenu__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
}

.terminal-submenu__error {
  padding: 8px 12px;
  color: hsl(var(--destructive));
  font-size: 13px;
}

.terminal-submenu__empty {
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.terminal-submenu__trigger .terminal-admin-hint__icon ~ .sigma-ui-context-menu-shortcut,
.terminal-submenu__trigger .terminal-admin-hint__icon ~ .sigma-ui-context-menu-sub-trigger__icon {
  margin-left: 0;
}

.terminal-submenu__default-badge ~ .terminal-admin-hint__icon {
  margin-inline-start: 0;
}

.terminal-submenu__item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.terminal-submenu__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  object-fit: contain;
}

.terminal-submenu__default-badge {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  margin-inline-start: auto;
  opacity: 0.7;
}
</style>
