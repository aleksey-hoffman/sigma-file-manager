<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { CommandIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();

async function handleClick() {
  await shortcutsStore.executeShortcut('toggleCommandPalette');
}
</script>

<template>
  <div class="command-palette-toolbar-button animate-fade-in">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="command-palette-toolbar-button__button"
          @click="handleClick"
        >
          <CommandIcon
            :size="16"
            class="command-palette-toolbar-button__icon"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <div class="command-palette-toolbar-button__tooltip-row">
          {{ t('shortcuts.toggleCommandPalette') }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('toggleCommandPalette') }}</ContextMenuShortcut>
        </div>
      </TooltipContent>
    </Tooltip>
  </div>
</template>

<style scoped>
.command-palette-toolbar-button :deep(.sigma-ui-button) {
  width: 28px;
  height: 28px;
}

.command-palette-toolbar-button__icon {
  stroke: hsl(var(--foreground) / 50%);
}

.command-palette-toolbar-button__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
