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
  ContextMenuLabel,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { useTerminalsStore } from '@/stores/runtime/terminals';
import { TerminalSquareIcon } from 'lucide-vue-next';

const props = defineProps<{
  selectedEntries: DirEntry[];
  isShiftHeld: boolean;
}>();

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();
const terminalsStore = useTerminalsStore();

const ADMIN_MODIFIER_KEY = 'Shift';

const targetDirectoryPath = computed(() => {
  const firstEntry = props.selectedEntries[0];
  if (!firstEntry) return null;

  if (firstEntry.is_dir) {
    return firstEntry.path;
  }

  const lastSeparator = Math.max(
    firstEntry.path.lastIndexOf('/'),
    firstEntry.path.lastIndexOf('\\'),
  );

  if (lastSeparator > 0) {
    return firstEntry.path.substring(0, lastSeparator);
  }

  return firstEntry.path;
});

async function handleOpenTerminal(terminalId: string) {
  if (!targetDirectoryPath.value) return;

  await terminalsStore.openTerminal(targetDirectoryPath.value, terminalId, props.isShiftHeld);
}
</script>

<template>
  <ContextMenuSub>
    <ContextMenuSubTrigger class="terminal-submenu__trigger">
      <TerminalSquareIcon :size="16" />
      <span>{{ t('terminal.openInTerminal') }}</span>
      <kbd class="shortcut terminal-submenu__shortcut">{{ shortcutsStore.getShortcutLabel('openTerminal') }}</kbd>
    </ContextMenuSubTrigger>
    <ContextMenuSubContent class="terminal-submenu">
      <template v-if="terminalsStore.loadError">
        <div class="terminal-submenu__error">
          {{ terminalsStore.loadError }}
        </div>
      </template>

      <template v-else-if="terminalsStore.hasLoaded && terminalsStore.terminals.length === 0">
        <div class="terminal-submenu__empty">
          {{ t('terminal.noTerminalsFound') }}
        </div>
      </template>

      <template v-else>
        <ContextMenuLabel class="terminal-submenu__hint">
          <i18n-t
            keypath="terminal.holdModifierForAdmin"
            tag="span"
          >
            <template #modifier>
              <kbd>{{ ADMIN_MODIFIER_KEY }}</kbd>
            </template>
          </i18n-t>
          <kbd class="shortcut terminal-submenu__hint-shortcut">{{ shortcutsStore.getShortcutLabel('openTerminalAdmin') }}</kbd>
        </ContextMenuLabel>

        <ContextMenuSeparator />

        <ContextMenuItem
          v-for="terminal in terminalsStore.terminals"
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

.terminal-submenu__shortcut {
  margin-left: auto;
  opacity: 0.6;
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

.terminal-submenu__hint {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-style: italic;
  gap: 8px;
}

.terminal-submenu__hint-shortcut {
  margin-left: auto;
  font-style: normal;
  opacity: 0.6;
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
</style>
