<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { InfoIcon } from '@lucide/vue';

defineProps<{
  isMainMenuItem?: boolean;
  showsShortcut?: boolean;
}>();

const shortcutsStore = useShortcutsStore();

const ADMIN_MODIFIER_KEY = 'Shift';
</script>

<template>
  <Tooltip :delay-duration="isMainMenuItem ? 250 : undefined">
    <TooltipTrigger as-child>
      <span class="terminal-admin-hint__icon">
        <InfoIcon :size="14" />
      </span>
    </TooltipTrigger>
    <TooltipContent
      :align="isMainMenuItem ? 'end' : 'center'"
      :class="{ 'terminal-admin-hint__content--narrow': isMainMenuItem }"
    >
      <div class="terminal-admin-hint__row">
        <i18n-t
          keypath="terminal.holdModifierForAdmin"
          tag="span"
        >
          <template #modifier>
            <ContextMenuShortcut>{{ ADMIN_MODIFIER_KEY }}</ContextMenuShortcut>
          </template>
        </i18n-t>
        <ContextMenuShortcut v-if="showsShortcut && shortcutsStore.getShortcutLabel('openTerminalAdmin')">
          {{ shortcutsStore.getShortcutLabel('openTerminalAdmin') }}
        </ContextMenuShortcut>
      </div>
    </TooltipContent>
  </Tooltip>
</template>

<style>
.terminal-admin-hint__icon {
  display: inline-flex;
  color: hsl(var(--muted-foreground));
  margin-inline-start: auto;
}

.terminal-admin-hint__content--narrow {
  max-width: 220px;
}

.terminal-admin-hint__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
