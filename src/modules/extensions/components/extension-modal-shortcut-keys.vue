<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import type { KeyboardShortcut } from '@/types/extension';
import {
  ENTER_KEY_LABEL,
  formatKeyboardShortcut,
} from '@/modules/extensions/utils/modal-keyboard-shortcut';

const props = defineProps<{
  shortcut?: KeyboardShortcut;
  parts?: string[];
  danger?: boolean;
}>();

const shortcutParts = computed(() => {
  if (props.parts) {
    return props.parts;
  }

  if (props.shortcut) {
    return formatKeyboardShortcut(props.shortcut);
  }

  return [];
});

function isEnterKeyLabel(part: string): boolean {
  return part === ENTER_KEY_LABEL;
}
</script>

<template>
  <span
    class="ext-modal-shortcut-keys"
    :class="{ 'ext-modal-shortcut-keys--danger': danger }"
  >
    <span
      v-for="(part, partIndex) in shortcutParts"
      :key="`${part}-${partIndex}`"
      class="ext-modal-shortcut-keys__key"
      :class="{ 'ext-modal-shortcut-keys__key--enter': isEnterKeyLabel(part) }"
    >
      {{ part }}
    </span>
  </span>
</template>

<style scoped>
.ext-modal-shortcut-keys {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ext-modal-shortcut-keys__key {
  display: inline-flex;
  min-width: 1.25rem;
  align-items: center;
  justify-content: center;
  padding: 1px 5px;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.4;
}

.ext-modal-shortcut-keys__key--enter {
  font-size: 0.875rem;
  line-height: 1;
}

.ext-modal-shortcut-keys--danger .ext-modal-shortcut-keys__key {
  border-color: hsl(var(--dangerous) / 30%);
  background: hsl(var(--dangerous) / 10%);
  color: hsl(var(--dangerous));
}
</style>
