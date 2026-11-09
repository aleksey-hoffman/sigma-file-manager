<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDownIcon, ClipboardPasteIcon } from '@lucide/vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getPasteTargetLabelKey,
  type ExternalClipboardPasteTarget,
} from './external-clipboard-context';

const props = withDefaults(defineProps<{
  targets: ExternalClipboardPasteTarget[];
  canPasteTo: (target: ExternalClipboardPasteTarget) => boolean;
  size?: 'default' | 'small';
}>(), {
  size: 'default',
});

const emit = defineEmits<{
  paste: [target: ExternalClipboardPasteTarget];
}>();

const isMenuOpen = defineModel<boolean>('menuOpen', { default: false });

const { t } = useI18n();

const singleTarget = computed(() => props.targets.length === 1 ? props.targets[0] : null);
const hasPasteTarget = computed(() => props.targets.some(target => props.canPasteTo(target)));
const iconSize = computed(() => props.size === 'small' ? 13 : 14);
</script>

<template>
  <button
    v-if="singleTarget"
    type="button"
    class="external-clipboard-paste-button"
    :class="`external-clipboard-paste-button--${props.size}`"
    :disabled="!props.canPasteTo(singleTarget)"
    @click="emit('paste', singleTarget)"
  >
    <ClipboardPasteIcon :size="iconSize" />
    <span>{{ t('fileBrowser.actions.paste') }}</span>
  </button>
  <DropdownMenu
    v-else
    v-model:open="isMenuOpen"
    :modal="false"
  >
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="external-clipboard-paste-button"
        :class="`external-clipboard-paste-button--${props.size}`"
        :disabled="!hasPasteTarget"
      >
        <ClipboardPasteIcon :size="iconSize" />
        <span>{{ t('fileBrowser.actions.paste') }}</span>
        <ChevronDownIcon
          :size="12"
          class="external-clipboard-paste-button__chevron"
        />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      side="top"
      align="end"
      :side-offset="6"
      class="external-clipboard-paste-menu"
    >
      <DropdownMenuItem
        v-for="target in props.targets"
        :key="target.paneIndex ?? 'active'"
        class="external-clipboard-paste-menu__item"
        :disabled="!props.canPasteTo(target)"
        @select="emit('paste', target)"
      >
        <ClipboardPasteIcon :size="14" />
        {{ t(getPasteTargetLabelKey(target)) }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<style>
.external-clipboard-paste-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: hsl(var(--foreground));
  cursor: pointer;
  font-weight: 500;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.external-clipboard-paste-button--default {
  height: 30px;
  padding: 0 11px;
  font-size: 12px;
  gap: 6px;
}

.external-clipboard-paste-button--small {
  height: 28px;
  padding: 0 9px;
  border: 1px solid hsl(var(--border) / 70%);
  border-radius: 7px;
  background-color: hsl(var(--background-3) / 60%);
  font-size: 11.5px;
  gap: 5px;
}

.external-clipboard-paste-button:not(:disabled):hover,
.external-clipboard-paste-button[data-state="open"] {
  border-color: hsl(var(--success) / 50%);
  background-color: hsl(var(--success) / 16%);
  color: hsl(var(--success));
}

.external-clipboard-paste-button:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}

.external-clipboard-paste-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.external-clipboard-paste-button__chevron {
  margin-left: -1px;
  opacity: 0.7;
  transition: transform 0.15s ease;
}

.external-clipboard-paste-button[data-state="open"] .external-clipboard-paste-button__chevron {
  transform: rotate(180deg);
}

.external-clipboard-paste-menu {
  min-width: 170px;
}
</style>
